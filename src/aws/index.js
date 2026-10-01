const { error: { catchErrors, wrapErrors } } = require('puffy')
const fs = require('fs')
const { homedir, EOL } = require('os')
const { join } = require('path')
const { exec, run, isCommandExist } = require('../core')
const { CLI_VERSION } = require('../settings')
const fileHelper = require('../fileHelper')
const transforms = require('./transforms')
const { loginFlags } = require('./login')
const regions = require('./regions')

const IS_WINDOWS = process.platform === 'win32'
const NL = IS_WINDOWS ? '\n' : EOL
const AWS_CONFIG_FILE = join(homedir(), '.aws', 'config')
const AWS_CREDS_FILE = join(homedir(), '.aws', 'credentials')
const AWS_SSO_FOLDER = join(homedir(), '.aws', 'sso', 'cache')

const awsExists = isCommandExist('aws')
let _awsCliVersion = null

/**
 * Returns the AWS CLI version (e.g., '2.33.17').
 */
const getAwsCliVersion = async () => {
	if (_awsCliVersion)
		return _awsCliVersion
	const data = await exec('aws --version') || ''
	_awsCliVersion = ((data.match(/aws-cli\/(\S+)/)||[])[1]) || null
	return _awsCliVersion
}

const awsCliV2Exists = noFailIfMissing => catchErrors((async () => {
	const [awsCliErrors] = await awsExists()
	if (awsCliErrors) {
		if (noFailIfMissing)
			return false
		throw wrapErrors('AWS CLI error', awsCliErrors)
	}

	try {
		const version = ((await getAwsCliVersion())||'').split('.')[0]*1
		if (!version || isNaN(version))
			throw new Error('Fail to test the AWS CLI version. Please try to run "aws --version" manually to try to debug this issue.')
		if (version <= 1)
			throw new Error(`AWS CLI version ${version} is not supported. Please upgrade to AWS CLI v2 or greater.`)

		return true
	} catch(err) {
		throw wrapErrors('Fail to check AWS CLI\'s version', [err])
	}
})())

const getParam = (params, paramName) => {
	if (!params || !params.length || !paramName)
		return null

	const regexp = new RegExp(`\\s*${paramName}\\s*=\\s*`)
	return params.filter(p => regexp.test(p)).map(p => p.replace(regexp,'').trim())[0]
}

const readText = async file => {
	try {
		return await fs.promises.readFile(file, 'utf8')
	} catch(err) {
		if (err.code == 'ENOENT')
			return ''
		throw err
	}
}

const getCredsFile = () => catchErrors(readText(AWS_CREDS_FILE))
const getConfigFile = () => catchErrors(readText(AWS_CONFIG_FILE))

/**
 * Writes an AWS file, creating ~/.aws if needed. New files are created with owner-only permissions. An empty
 * content for a file that does not exist is not written.
 */
const writeAwsFile = async (file, content) => {
	const exists = await fileHelper.exists(file)
	if (!exists && !content)
		return
	await fs.promises.mkdir(join(homedir(), '.aws'), { recursive:true })
	await fs.promises.writeFile(file, content, exists ? undefined : { mode:0o600 })
}

const writeAwsFiles = async ({ config, creds }) => {
	if (config !== undefined)
		await writeAwsFile(AWS_CONFIG_FILE, config)
	if (creds !== undefined)
		await writeAwsFile(AWS_CREDS_FILE, creds)
}

/**
 * Copies ~/.aws/config and ~/.aws/credentials next to themselves (e.g., 'config.bak-2026-10-01T10-12-00Z').
 *
 * @return {Array} Paths of the backups created.
 */
const backupAwsFiles = () => catchErrors((async () => {
	const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-')
	const backups = []
	for (const file of [AWS_CONFIG_FILE, AWS_CREDS_FILE]) {
		if (await fileHelper.exists(file)) {
			const backup = `${file}.bak-${stamp}`
			await fs.promises.copyFile(file, backup)
			backups.push(backup)
		}
	}
	return backups
})())

/**
 * Gets all the profiles stored in the ~/.aws/config file.
 *
 * @return {[Error]}
 * @return {String}		profiles[].name				e.g., 'hello'
 * @return {String}		profiles[].friendlyName		e.g., 'hello (SSO [role:"god"  account:1234])'
 * @return {String}		profiles[].region			e.g., 'us-west-1'
 * @return {String}		profiles[].sso_start_url	e.g., 'https://cloudless.awsapps.com/start'
 * @return {String}		profiles[].sso_region		e.g., 'us-west-1'
 * @return {String}		profiles[].sso_account_id	e.g., '1234'
 * @return {String}		profiles[].sso_role_name	e.g., 'god'
 * @return {String}		profiles[].sso_session		e.g., 'cloudless'
 * @return {Boolean}	profiles[].isSso
 * @return {Boolean}	profiles[].isLegacySso		SSO profile without [sso-session] (no auto-refresh)
 */
const listProfiles = () => catchErrors((async () => {
	await awsCliV2Exists()
	const [configStrErrors, configStr] = await getConfigFile()
	if (configStrErrors)
		throw wrapErrors('Fail to list AWS profiles', configStrErrors)

	return transforms.listProfiles(configStr)
})())

/**
 * Describes the local SSO login for a start URL, based on the AWS CLI's cache in ~/.aws/sso/cache.
 *
 * @param  {String} ssoUrl					e.g., 'https://cloudless.awsapps.com/start'
 *
 * @return {[Error]}
 * @return {String} status.state			'refreshable' (sso-session with refresh token), 'active' (legacy, not
 *                                  		expired yet), 'expired' or 'none'
 * @return {Date}   status.expiresAt		Only for 'active' and 'expired'
 */
const getSsoLoginStatus = ssoUrl => catchErrors((async () => {
	let ssoHost
	try {
		ssoHost = new URL(ssoUrl).host
	} catch {
		throw new Error(`The SSO portal URL ${ssoUrl} is not a valid URL.`)
	}

	const files = await fs.promises.readdir(AWS_SSO_FOLDER).catch(() => [])
	const tokens = []
	for (const f of files.filter(f => f.endsWith('.json'))) {
		const token = await fileHelper.json.get(join(AWS_SSO_FOLDER, f)).catch(() => null)
		if (!token || !token.startUrl || !token.accessToken)
			continue
		let host = null
		try { host = new URL(token.startUrl).host } catch { continue }
		if (host == ssoHost)
			tokens.push(token)
	}

	if (!tokens.length)
		return { state:'none' }

	const now = Date.now()
	const refreshable = tokens.find(t => t.refreshToken && (!t.registrationExpiresAt || new Date(t.registrationExpiresAt).getTime() > now))
	if (refreshable)
		return { state:'refreshable' }

	const latest = tokens.map(t => new Date(t.expiresAt)).filter(d => !isNaN(d)).sort((a,b) => b-a)[0]
	if (!latest)
		return { state:'none' }
	return { state: latest.getTime() - 2*60*1000 > now ? 'active' : 'expired', expiresAt:latest }
})())

const exportCredentials = async profile => {
	const data = await run('aws', ['configure', 'export-credentials', '--profile', profile, '--format', 'process'])
	const parsed = JSON.parse(data)
	if (!parsed.AccessKeyId)
		throw new Error(`No credentials returned for profile ${profile}`)
	return parsed
}

/**
 * Logs in to the profile's SSO session in this terminal (the user sees the URL and, in device code mode,
 * the code to approve).
 *
 * @param  {String} profile
 * @param  {String} loginMode		'auto' | 'device' | 'browser'
 */
const ssoLogin = (profile, loginMode) => catchErrors((async () => {
	const flags = loginFlags(loginMode, { env:process.env, platform:process.platform, cliVersion:await getAwsCliVersion() })
	await run('aws', ['sso', 'login', '--profile', profile, ...flags], { inherit:true })
})())

/**
 * Makes sure a profile can produce credentials. For SSO profiles, this triggers 'aws sso login' when the
 * session is missing or expired (or always, with 'force'). AWS tools then refresh credentials on their own.
 *
 * @param  {Object}  profile			Item returned by listProfiles
 * @param  {String}  options.loginMode
 * @param  {Boolean} options.force		Logs in again even if the session is valid.
 *
 * @return {[Error]}
 * @return {Date}    expiry_date		When the current role credentials expire (SSO only, informational).
 */
const ensureCredentials = (profile, options) => catchErrors((async () => {
	await awsCliV2Exists()
	const { loginMode, force } = options || {}
	if (!profile.isSso)
		return {}

	if (!force) {
		const creds = await exportCredentials(profile.name).catch(() => null)
		if (creds)
			return { expiry_date: creds.Expiration ? new Date(creds.Expiration) : null }
	}

	const [loginErrors] = await ssoLogin(profile.name, loginMode)
	if (loginErrors)
		throw wrapErrors(`Fail to log in to the SSO session of profile ${profile.name}`, loginErrors)

	try {
		const creds = await exportCredentials(profile.name)
		return { expiry_date: creds.Expiration ? new Date(creds.Expiration) : null }
	} catch(err) {
		throw wrapErrors(`Logged in, but failed to get credentials for profile ${profile.name}`, [err])
	}
})())

/**
 * Makes 'name' the default profile. See transforms.setDefaultProfile for what is written.
 */
const setDefaultProfile = name => catchErrors((async () => {
	const errMsg = `Fail to set profile ${name} as the default`
	const [configStrErrors, configStr] = await getConfigFile()
	const [credsStrErrors, credsStr] = await getCredsFile()
	if (credsStrErrors||configStrErrors)
		throw wrapErrors(errMsg, credsStrErrors||configStrErrors)

	try {
		await writeAwsFiles(transforms.setDefaultProfile(configStr, credsStr, name, CLI_VERSION))
	} catch(err) {
		throw wrapErrors(errMsg, [err])
	}
})())

/**
 * @return {String} default.profile		Name of the profile switch-profile last set as default, or null.
 */
const getDefaultProfile = () => catchErrors((async () => {
	const [configStrErrors, configStr] = await getConfigFile()
	const [credsStrErrors, credsStr] = await getCredsFile()
	if (credsStrErrors||configStrErrors)
		throw wrapErrors('Fail to get the default AWS profile', credsStrErrors||configStrErrors)

	return { profile: transforms.getDefaultProfileName(configStr, credsStr) }
})())

const deleteProfileFromConfig = (profile, fileContent) => {
	fileContent = fileContent || ''
	const regExp = new RegExp(`\\[(profile\\s){0,1}${profile}\\]((.|\\n|\\r)*?)(\\[|$)`)
	const profileMatch = (fileContent.match(regExp)||[])[0] || ''

	if (!profileMatch)
		return fileContent

	const lastChar = profileMatch.slice(-1)
	return fileContent.replace(profileMatch, lastChar)
}

const deleteProfileFromCreds = (profile, fileContent) => {
	fileContent = fileContent || ''
	const regExp = new RegExp(`\\[${profile}\\]((.|\\n|\\r)*?)(\\[|$)`)
	const profileMatch = (fileContent.match(regExp)||[])[0] || ''

	if (!profileMatch)
		return fileContent

	const lastChar = profileMatch.slice(-1)
	return fileContent.replace(profileMatch, lastChar)
}

const deleteProfiles = profiles => catchErrors((async () => {
	if (!profiles || !profiles.length)
		return

	const errMsg = 'Fail to delete AWS profiles'

	if (profiles.some(p => p == 'default'))
		throw wrapErrors(errMsg, [new Error('The \'default\' profile cannot be deleted.')])

	let [configStrErrors, configStr] = await getConfigFile()
	let [credsStrErrors, credsStr] = await getCredsFile()

	if (configStrErrors || credsStrErrors)
		throw wrapErrors(errMsg, configStrErrors || credsStrErrors)

	const updateConfig = configStr
	const updateCreds = credsStr

	for (let i=0;i<profiles.length;i++) {
		const profile = profiles[i]
		configStr = deleteProfileFromConfig(profile, configStr)
		credsStr = deleteProfileFromCreds(profile, credsStr)
	}

	if (updateConfig)
		await writeAwsFile(AWS_CONFIG_FILE, configStr)
	if (updateCreds)
		await writeAwsFile(AWS_CREDS_FILE, credsStr)
})())

const createProfile = ({ name, aws_access_key_id, aws_secret_access_key, region }) => catchErrors((async () => {
	await awsCliV2Exists()

	const errMsg = 'Fail to create AWS profile'
	if (!name)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'name\'.')])
	if (!region)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'region\'.')])
	if (!aws_access_key_id)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'aws_access_key_id\'.')])
	if (!aws_secret_access_key)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'aws_secret_access_key\'.')])

	let [configStrErrors, configStr] = await getConfigFile()
	let [credsStrErrors, credsStr] = await getCredsFile()
	if (configStrErrors||credsStrErrors)
		throw wrapErrors(errMsg, configStrErrors||credsStrErrors)

	const newCreds = [
		`[${name}]`,
		`aws_access_key_id = ${aws_access_key_id}`,
		`aws_secret_access_key = ${aws_secret_access_key}`,
		`${transforms.VERSION_KEY} = ${CLI_VERSION}`
	].join(NL) + NL
	const newConfig = [
		`[profile ${name}]`,
		`region = ${region}`,
		'output = json',
		`${transforms.VERSION_KEY} = ${CLI_VERSION}`
	].join(NL) + NL

	const append = (str, section) => (str || '').trim() ? str.replace(/\s+$/, '') + NL + NL + section : section

	await writeAwsFile(AWS_CONFIG_FILE, append(configStr, newConfig))
	await writeAwsFile(AWS_CREDS_FILE, append(credsStr, newCreds))
})())

/**
 * Creates an SSO profile with the interactive 'aws configure sso' flow, then stamps it. If the user skipped
 * the SSO session name (legacy format, no auto-refresh), the profile is upgraded to the [sso-session] format.
 *
 * @return {Boolean} upgraded		True if the profile had to be upgraded (the user will need to log in again).
 */
const createSsoProfile = name => catchErrors((async () => {
	await awsCliV2Exists()
	try {
		await run('aws', ['configure', 'sso', '--profile', name], { inherit:true })
	} catch(err) {
		throw new Error(`'aws configure sso' failed (${err.message}). The SSO profile may not have been created correctly.`)
	}

	const [configStrErrors, configStr] = await getConfigFile()
	if (configStrErrors)
		throw wrapErrors('Fail to read the new SSO profile', configStrErrors)

	const isLegacy = transforms.findLegacySsoProfiles(configStr).includes(name)
	const { config } = isLegacy
		? transforms.upgradeLegacySsoProfiles(configStr, [name], CLI_VERSION)
		: { config: transforms.stampProfile(configStr, name, CLI_VERSION) }
	await writeAwsFile(AWS_CONFIG_FILE, config)
	return isLegacy
})())

module.exports = {
	AWS_CONFIG_FILE,
	AWS_CREDS_FILE,
	listProfiles,
	ensureCredentials,
	ssoLogin,
	getSsoLoginStatus,
	getDefaultProfile,
	setDefaultProfile,
	deleteProfiles,
	createProfile,
	createSsoProfile,
	backupAwsFiles,
	getConfigFile,
	getCredsFile,
	writeAwsFiles,
	getAwsCliVersion,
	regions,
	awsCliV2Exists,
	getParam
}

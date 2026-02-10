const { error: { catchErrors, wrapErrors }, promise: { delay } } = require('puffy')
const { homedir, EOL } = require('os')
const { join } = require('path')
const { exec, isCommandExist } = require('../core')
const { spawn } = require('child_process')
const fileHelper = require('../fileHelper')
const regions = require('./regions')

const SSO_GET_CREDS_TIMEOUT = 5*60*1000 // 5 minutes to complete the SSO login
const AWS_CONFIG_FILE = join(homedir(), '.aws', 'config')
const AWS_CREDS_FILE = join(homedir(), '.aws', 'credentials')
const AWS_SSO_FOLDER = join(homedir(), '.aws', 'sso', 'cache')
const AWS_CLI_FOLDER = join(homedir(), '.aws', 'cli', 'cache')
const DEFAULT_CONFIG = 
`[default]
region = ap-southeast-1
output = json

`
const DEFAULT_CREDS = 
`[default]
aws_access_key_id = 1234_DUMMY
aws_secret_access_key = 4567_DUMMY

`

const awsExists = isCommandExist('aws')
const awsCliV2Exists = noFailIfMissing => catchErrors((async () => {
	const [awsCliErrors] = await awsExists()
	if (awsCliErrors) {
		if (noFailIfMissing)
			return false
		throw wrapErrors('AWS CLI error', awsCliErrors)
	}

	try {
		const data = await exec('aws --version') || ''
		const [majorVersion] = ((data.match(/aws-cli\/(.*?)\s/g)||[])[0]||'').replace('aws-cli/','').split('.')
		const version = majorVersion*1
		if (isNaN(version))
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

const getCredsFile = () => catchErrors((async () => {
	const credsExist = await fileHelper.exists(AWS_CREDS_FILE)
	if (!credsExist)
		return ''
	const credsStr = (await fileHelper.read(AWS_CREDS_FILE) || '').toString()

	return credsStr
})())

const getConfigFile = () => catchErrors((async () => {
	const credsExist = await fileHelper.exists(AWS_CONFIG_FILE)
	if (!credsExist)
		return ''
	const credsStr = (await fileHelper.read(AWS_CONFIG_FILE) || '').toString()

	return credsStr
})())

/**
 * Gets all the profiles stored in the ~/.aws/config file. 
 * 
 * @return {[Error]}
 * @return {String}		profiles[].name				e.g., 'hello'
 * @return {String}		profiles[].friendlyName		e.g., 'hello (SSO [role:"god"  account:1234])'
 * @return {String}		profiles[].region			e.g., 'us-weat-1'
 * @return {String}		profiles[].output			e.g., 'json'
 * @return {String}		profiles[].sso_start_url	e.g., 'https://cloudless.awsapps.com/start'
 * @return {String}		profiles[].sso_region		e.g., 'us-weat-1'
 * @return {String}		profiles[].sso_account_id	e.g., '1234'
 * @return {String}		profiles[].sso_role_name	e.g., 'god'
 */
const listProfiles = () => catchErrors((async () => {
	await awsCliV2Exists()
	const [configStrErrors, configStr] = await getConfigFile()
	if (configStrErrors)
		throw wrapErrors('Fail to list AWS profiles', configStrErrors)

	if (!configStr)
		return []

	const profiles = configStr.match(/\[(.*?)\]/g)
	return profiles.map(profile => {
		const [,rest=''] = configStr.split(profile)
		const [config=''] = rest.split('[')
		const params = config.split(EOL)
		const p = {
			name: profile.replace(/(^\[profile\s+|\[|\])/g, ''),
			sso_start_url: getParam(params, 'sso_start_url'),
			sso_region: getParam(params, 'sso_region'),
			sso_account_id: getParam(params, 'sso_account_id'),
			sso_role_name: getParam(params, 'sso_role_name'),
			region: getParam(params, 'region'),
			output: getParam(params, 'output')
		}

		if (p.sso_region)
			p.region = p.sso_region

		p.friendlyName = `${p.name}${p.sso_start_url ? ` (SSO [role:${p.sso_role_name||'unknown'} - account:${p.sso_account_id||'unknown'}])` : ''}`

		return p 
	}).filter(p => p.name != 'default')
})())

/**
 * Gets the session details associated with this 'ssoUrl' from the local folder '.aws/sso/cache/'.
 * If the session exists but has expired, null is returned.
 * 
 * @param  {String} ssoUrl 					e.g., 'https://cloudless.awsapps.com/start'
 * 
 * @return {[Error]} 
 * @return {String} session.startUrl		e.g., 'https://cloudless.awsapps.com/start'
 * @return {String} session.region			e.g., 'ap-southeast-2'
 * @return {String} session.accessToken		e.g., 'dwqdwdwqd...dwqdqw'
 * @return {String} session.expiresAt		e.g., '2021-07-17T11:33:12Z'
 */
const getSsoSession = ssoUrl => catchErrors((async () => {
	const ssoHost = new URL(ssoUrl).host
	if (!ssoHost)
		throw new Error(`The SSO portal URL ${ssoUrl} is not  a valid URL.`)

	const ssoFolderExists = await fileHelper.exists(AWS_SSO_FOLDER)
	if (!ssoFolderExists)
		throw new Error(`AWS SSO folder ${AWS_SSO_FOLDER} not found.`)	
	const files = await fileHelper.list(AWS_SSO_FOLDER, { pattern:'*.json' })
	if (!files || !files.length)
		throw new Error(`AWS SSO folder ${AWS_SSO_FOLDER} contains no credentials.`)
	let creds = null
	for (let i=0;i<files.length;i++) {
		const _creds = await fileHelper.json.get(files[i])
		if (_creds.startUrl && _creds.expiresAt) {
			const credHost = new URL(_creds.startUrl).host
			const credStillValid = (Date.now() - 2*60*1000) < new Date(_creds.expiresAt).getTime()
			if (credHost == ssoHost && credStillValid && _creds.accessToken) {
				creds = _creds
				continue
			}
		}
	}

	return creds
})())

/**
 * Gets the credentials details associated with the 'access_key_end' and 'secret_key_end' from the local folder '.aws/cli/cache/'.
 * We need this function because unfortunatelly, the 'aws configure list' does not output the details in full. Instead, it stores 
 * them in the cache file.
 * 
 * @param  {String} access_key_end			e.g., '1234'
 * @param  {String} secret_key_end			e.g., '5678'
 * 
 * @return {[Error]} 
 * @return {String} session.aws_access_key_id		e.g., '********1234'
 * @return {String} session.aws_secret_access_key	e.g., '********5678'
 * @return {String} session.aws_session_token		e.g., 'dwqdwdwqd...dwqdqw'
 * @return {Date}   session.expiry_date				e.g., 2021-07-17T11:33:12Z
 */
const getSsoCredsFromCacheFile = (access_key_end, secret_key_end) => catchErrors((async () => {
	const errMsg = `Fail to get the local CLI credentials from folder ${AWS_CLI_FOLDER}`
	if (!access_key_end)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'access_key_end\'.')])
	if (!secret_key_end)
		throw wrapErrors(errMsg, [new Error('Missing required argument \'secret_key_end\'.')])

	const folderExists = await fileHelper.exists(AWS_CLI_FOLDER)
	if (!folderExists)
		return null
	const files = await fileHelper.list(AWS_CLI_FOLDER, { pattern:'*.json' })
	if (!files || !files.length)
		return null

	for (let i=0;i<files.length;i++) {
		const _creds = await fileHelper.json.get(files[i])

		// Creds must be SSO
		if (!_creds || _creds.ProviderType != 'sso' || !_creds.Credentials)
			continue

		// Creds must still be valid for the next 2 minutes
		if (_creds.Credentials.Expiration && (Date.now() - 2*60*1000) < new Date(_creds.Credentials.Expiration).getTime()) {
			const credsMatch = (_creds.Credentials.AccessKeyId||'').slice(-4) == access_key_end && 
				(_creds.Credentials.SecretAccessKey||'').slice(-4) == secret_key_end

			if (credsMatch)
				return {
					aws_access_key_id: _creds.Credentials.AccessKeyId,
					aws_secret_access_key: _creds.Credentials.SecretAccessKey,
					aws_session_token: _creds.Credentials.SessionToken,
					expiry_date: new Date(_creds.Credentials.Expiration)
				}
		}
	}

	return null
})())

/**
 * Gets SSO credentials. It executes the 'aws configure list --profile <PROFILE>' command, which 
 * checks the local cache first (i.e., '~/.aws/cli/cache'). If that cache for that profile does not exist or if it
 * is expired, it goes to AWS to fetch new ones and refresh the cache. 
 * 
 * @param  {String} profile		e.g., 'sso-dev-cloudless'
 * 
 * @return {[Error]} 
 * @return {String} session.aws_access_key_id		e.g., '********1234'
 * @return {String} session.aws_secret_access_key	e.g., '********5678'
 * @return {String} session.aws_session_token		e.g., 'dwqdwdwqd...dwqdqw'
 * @return {Date}   session.expiry_date				e.g., 2021-07-17T11:33:12Z
 */
const getSsoCredentials = profile => catchErrors((async () => {
	await awsCliV2Exists()
	const errMsg = `Fail to get AWS SSO credentials for profile ${profile}`
	try {
		if (!profile)
			throw wrapErrors(errMsg, [new Error('Missing required \'profile\' argument')])
		const data = await exec(`aws configure list --profile ${profile}`) || ''
		const access_key_end = ((data.match(/access_key\s*\*+.{4}/g)||[])[0]||'').slice(-4)
		const secret_key_end = ((data.match(/secret_key\s*\*+.{4}/g)||[])[0]||'').slice(-4)

		if (!access_key_end || !secret_key_end)
			return null 

		const [ssoCredsErrors, creds] = await getSsoCredsFromCacheFile(access_key_end, secret_key_end)

		if (ssoCredsErrors)
			throw wrapErrors(errMsg, ssoCredsErrors)
		return creds
	} catch(err) {
		throw wrapErrors(errMsg, [err])
	}
})())

const isSSOexpired = ssoSession => {
	if (!ssoSession)
		return true

	return (new Date(ssoSession.expiresAt).getTime() - Date.now()) < (2*60*1000)
}

/**
 * Makes sure the profile is using a valid (i.e., exists and not expired) local SSO session. If not, try 
 * to create one manually by redirecting the user to the SSO page. 
 * 
 * @param  {String}  profile			e.g., 'sso-dev-cloudless'
 * @param  {String}  ssoUrl 			e.g., 'https://cloudless.awsapps.com/start'
 * @param  {Boolean} options.force		
 * 
 * @return {[Error]} 
 * @return {String} session.aws_access_key_id		e.g., '********1234'
 * @return {String} session.aws_secret_access_key	e.g., '********5678'
 * @return {String} session.aws_session_token		e.g., 'dwqdwdwqd...dwqdqw'
 * @return {Date}   session.expiry_date				e.g., 2021-07-17T11:33:12Z
 */
const refreshSsoSession = (profile, ssoUrl, options) => catchErrors((async () => {
	const errMsg = `Fail to refresh the SSO session for AWS profile ${profile}`
	let [ssoSessionErrors, ssoSession] = await getSsoSession(ssoUrl)
	if (ssoSessionErrors)
		throw wrapErrors(errMsg, ssoSessionErrors)

	const { force } = options || {}

	try {
		// No valid SSO session found. Manually get a new one via the SSO portal
		const startTime = Date.now()
		if (force || isSSOexpired(ssoSession)) {
			await exec(`aws sso login --profile ${profile}`)
			while (!ssoSession && Date.now() - startTime < SSO_GET_CREDS_TIMEOUT) {
				const resp = await getSsoSession(ssoUrl)
				if (resp[0])
					throw wrapErrors(errMsg, resp[0])
				ssoSession = resp[1]
				if (!ssoSession)
					await delay(2000)
			}
		}

		if (ssoSession)
			return ssoSession 
		else if (Date.now() - startTime > SSO_GET_CREDS_TIMEOUT)
			throw wrapErrors(errMsg, [new Error(`Timeout - Time to wait for refreshing the SSO session for profile ${profile} exceeded ${SSO_GET_CREDS_TIMEOUT}ms.`)])
		else
			return null
	} catch(err) {
		throw wrapErrors(errMsg, [err])
	}
})())

/**
 * Gets the AWS credentials for a specific profile. If that profile is an SSO profile, this function has a series of
 * side-effects:
 * 	- If the local SSO session stored under ~/.aws/sso/cache has expired, then it will redirect the user to the SSO portal and eventually refresh that ~/.aws/sso/cache.
 *  - If the local SSO creds stored under ~/.aws/cli/cache have expired (AWS_KEY, AWS_SECRET, AWS_SESSION), then they will be refreshed using the session stored under the ~/.aws/sso/cache.
 * 
 * @param  {String} profile		e.g., 'sso-dev-cloudless'
 * @param  {String} ssoUrl 		e.g., 'https://cloudless.awsapps.com/start'
 * 
 * @return {[Error]} 
 * @return {String} creds.aws_access_key_id		e.g., '********1234'
 * @return {String} creds.aws_secret_access_key	e.g., '********5678'
 * @return {String} creds.aws_session_token		e.g., 'dwqdwdwqd...dwqdqw'
 * @return {Date}   creds.expiry_date			e.g., 2021-07-17T11:33:12Z
 */
const getCredentials = (profile, ssoUrl) => catchErrors((async () => {
	await awsCliV2Exists()
	const errMsg = `Fail to get AWS credentials for profile ${profile}`
	if (ssoUrl) {
		await refreshSsoSession(profile, ssoUrl)
		let [ssoCredsErrors, ssoCreds] = await getSsoCredentials(profile)
		if (ssoCredsErrors) {
			const ssoSessionIsInvalid = ssoCredsErrors.some(e => e.message && e.message.toLowerCase().indexOf('session associated with this profile has expired') >= 0)
			if (ssoSessionIsInvalid) {
				await refreshSsoSession(profile, ssoUrl, { force:true })
				const resp = await getSsoCredentials(profile)
				if (resp[0])
					throw wrapErrors(errMsg, resp[0])

				ssoCreds = resp[1]
			} else
				throw wrapErrors(errMsg, ssoCredsErrors)
		}

		if (!ssoCreds) {
			try {
				const data = await exec(`aws configure export-credentials --profile ${profile} --format process`)
				const parsed = JSON.parse(data)
				if (parsed.AccessKeyId && parsed.SecretAccessKey) {
					ssoCreds = {
						aws_access_key_id: parsed.AccessKeyId,
						aws_secret_access_key: parsed.SecretAccessKey,
						aws_session_token: parsed.SessionToken,
						expiry_date: parsed.Expiration ? new Date(parsed.Expiration) : null
					}
				}
			} catch(e) {
				// Fallback also failed
			}
		}

		if (!ssoCreds)
			throw new Error(errMsg)

		return ssoCreds
	} else {
		const [errors, credsStr] = await getCredsFile()
		if (errors)
			throw wrapErrors(errMsg, errors)

		const [, rest] = credsStr.split(`[${profile}]`)
		const [config=''] = rest.split('[')
		const params = config.split(EOL)
		const creds = {
			aws_access_key_id: getParam(params, 'aws_access_key_id'),
			aws_secret_access_key: getParam(params, 'aws_secret_access_key'),
			aws_session_token: getParam(params, 'aws_session_token'),
			expiry_date: null
		}
		
		return creds
	}
})())


const updateDefaultProfile = ({ profile, region, expiry_date, aws_access_key_id, aws_secret_access_key, aws_session_token }) => catchErrors((async () => {
	const errMsg = `Fail to update the ${AWS_CREDS_FILE} file`
	const [configStrErrors, configStr] = await getConfigFile()
	const [credsStrErrors, credsStr] = await getCredsFile()
	if (credsStrErrors||configStrErrors)
		throw wrapErrors(errMsg, credsStrErrors||configStrErrors)

	const newDefaultCreds = '[default]'+EOL+
		`aws_access_key_id = ${aws_access_key_id}`+EOL+
		`aws_secret_access_key = ${aws_secret_access_key}`+EOL+
		(aws_session_token ? `aws_session_token = ${aws_session_token}`+EOL : '') +
		(expiry_date ? `expiry_date = ${expiry_date.toISOString()}`+EOL : '') +
		`profile = ${profile}`+EOL+EOL

	const newDefaultConfig = '[default]'+EOL+
		`region = ${region}`+EOL+
		'output = json'+EOL+EOL

	const defaultCredsSection = (credsStr.match(/\[default\]((.|\n|\r)*?)(\[|$)/)||[])[0]
	const defaultConfigSection = (configStr.match(/\[default\]((.|\n|\r)*?)(\[|$)/)||[])[0]

	let updatedCreds = ''
	if (defaultCredsSection) {
		const lastChar = defaultCredsSection.slice(-1)
		updatedCreds = credsStr.replace(defaultCredsSection, newDefaultCreds+lastChar)
	} else
		updatedCreds = newDefaultCreds + credsStr

	let updatedConfig = ''
	if (defaultConfigSection) {
		const lastChar = defaultConfigSection.slice(-1)
		updatedConfig = configStr.replace(defaultConfigSection, newDefaultConfig+lastChar)
	} else
		updatedConfig = newDefaultConfig + configStr
	
	await fileHelper.write(AWS_CREDS_FILE, updatedCreds)
	await fileHelper.write(AWS_CONFIG_FILE, updatedConfig)
})())

const getDefaultProfile = () => catchErrors((async () => {
	const errMsg = `Fail to get the default AWS profile in the ${AWS_CREDS_FILE} file.`
	const [errors, credsStr] = await getCredsFile()
	if (errors)
		throw wrapErrors(errMsg, errors)

	const params = ((credsStr.match(/\[default\]((.|\n|\r)*?)(\[|$)/)||[])[0]||'').split(EOL)
	const creds = {
		aws_access_key_id: getParam(params, 'aws_access_key_id'),
		aws_secret_access_key: getParam(params, 'aws_secret_access_key'),
		aws_session_token: getParam(params, 'aws_session_token'),
		expiry_date: getParam(params, 'expiry_date'),
		profile: getParam(params, 'profile')
	}

	return creds
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
		await fileHelper.write(AWS_CONFIG_FILE, configStr)
	if (updateCreds)
		await fileHelper.write(AWS_CREDS_FILE, credsStr)
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

	const configProfiles = [`[profile ${name}]`+EOL]
	const credsProfiles = [`[${name}]`+EOL]

	credsProfiles.push(`aws_access_key_id = ${aws_access_key_id}`+EOL)
	credsProfiles.push(`aws_secret_access_key = ${aws_secret_access_key}`+EOL+EOL)

	configProfiles.push(`region = ${region}`+EOL)
	configProfiles.push('output = json'+EOL+EOL)

	const newCreds = credsProfiles.join('')
	const newConfig = configProfiles.join('')

	if (!configStr)
		configStr = DEFAULT_CONFIG
	if (!credsStr)
		credsStr = DEFAULT_CREDS

	await fileHelper.write(AWS_CONFIG_FILE, configStr+EOL+newConfig)
	await fileHelper.write(AWS_CREDS_FILE, credsStr+EOL+newCreds)
})())

const createSsoProfile = name => catchErrors((async () => {
	await awsCliV2Exists()
	const exitCode = await new Promise(next => {
		const child = spawn('aws', ['configure', 'sso', '--profile', name],{ stdio: 'inherit' })
		child.on('exit', code => next(code))
	})
	if (exitCode !== 0)
		throw new Error(`'aws configure sso' exited with code ${exitCode}. The SSO profile may not have been created correctly.`)
})())

module.exports = {
	listProfiles,
	getCredentials,
	getDefaultProfile,
	updateDefaultProfile,
	deleteProfiles,
	createProfile,
	createSsoProfile,
	regions,
	awsCliV2Exists
}


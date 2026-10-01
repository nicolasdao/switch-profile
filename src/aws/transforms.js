/**
 * Pure transforms over the content of ~/.aws/config and ~/.aws/credentials. No I/O happens here, so every
 * rule about what switch-profile writes into those files can be unit tested.
 */
const ini = require('../ini')

const NAME_KEY = 'switch_profile_name'
const VERSION_KEY = 'switch_profile_version'
// Set on profiles generated from an SSO portal (value: the sso-session name), so pruning never touches
// hand-written profiles.
const GENERATED_KEY = 'switch_profile_generated'
// Optional human friendly account name, shown in the picker and searchable.
const ACCOUNT_NAME_KEY = 'switch_profile_account_name'
const OWN_KEYS = [NAME_KEY, VERSION_KEY, GENERATED_KEY, ACCOUNT_NAME_KEY]
// Custom keys written into [default] of ~/.aws/credentials by switch-profile 1.x.
const LEGACY_CREDS_KEYS = ['profile', 'expiry_date']
const SSO_SCOPES = 'sso:account:access'

/**
 * Returns the config section name of a profile, or null if it does not exist. Profiles are normally
 * '[profile name]' in ~/.aws/config, but '[name]' is tolerated.
 */
const configSectionName = (configStr, name) => {
	const sections = ini.listSections(configStr)
	if (name == 'default')
		return sections.includes('default') ? 'default' : null
	if (sections.includes(`profile ${name}`))
		return `profile ${name}`
	return sections.includes(name) ? name : null
}

const withoutKeys = (entries, keys) => (entries || []).filter(([k]) => !keys.includes(k))

/**
 * Makes 'name' the default profile by copying its settings (not its temporary credentials) into [default].
 *
 * 	- ~/.aws/config [default] gets the profile's own keys (sso_session, sso_account_id, role_arn, region, ...)
 * 	  plus the switch-profile stamps. AWS tools then resolve and refresh credentials themselves.
 * 	- ~/.aws/credentials [default] mirrors the profile's credentials section if it has one (static keys).
 * 	  Otherwise it is removed, because static keys in [default] would take precedence over the SSO settings.
 *
 * @param  {String} configStr
 * @param  {String} credsStr
 * @param  {String} name
 * @param  {String} version		CLI version used for the stamp.
 * @return {Object} { config, creds }
 */
const setDefaultProfile = (configStr, credsStr, name, version) => {
	const section = configSectionName(configStr, name)
	if (!section || name == 'default')
		throw new Error(`Profile ${name} not found in ~/.aws/config.`)

	const configEntries = [
		...withoutKeys(ini.getEntries(configStr, section), OWN_KEYS),
		[NAME_KEY, name],
		[VERSION_KEY, version]
	]
	const config = ini.setSection(configStr, 'default', configEntries, { position:'top' })

	const credsEntries = ini.getEntries(credsStr, name)
	const creds = credsEntries && credsEntries.length
		? ini.setSection(credsStr, 'default', [...withoutKeys(credsEntries, [...OWN_KEYS, ...LEGACY_CREDS_KEYS]), [VERSION_KEY, version]], { position:'top' })
		: ini.removeSection(credsStr, 'default')

	return { config, creds }
}

/**
 * Returns the name of the profile switch-profile last set as default, from either format.
 */
const getDefaultProfileName = (configStr, credsStr) => {
	const config = ini.getSection(configStr, 'default') || {}
	if (config[NAME_KEY])
		return config[NAME_KEY]
	const creds = ini.getSection(credsStr, 'default') || {}
	return creds.profile || null
}

/**
 * True when [default] of ~/.aws/credentials was written by switch-profile 1.x.
 */
const hasLegacyDefault = credsStr => {
	const creds = ini.getSection(credsStr, 'default')
	return !!creds && LEGACY_CREDS_KEYS.some(k => k in creds)
}

const getLegacyDefaultProfileName = credsStr => (ini.getSection(credsStr, 'default') || {}).profile || null

/**
 * Cleans a 1.x [default] whose profile no longer exists. Temporary credentials (with a session token) have
 * long expired and would override [default] of ~/.aws/config, so the section is removed. Static keys are
 * kept, minus the 1.x custom keys.
 */
const stripLegacyDefault = credsStr => {
	const creds = ini.getSection(credsStr, 'default') || {}
	if (creds.aws_session_token)
		return ini.removeSection(credsStr, 'default')
	return ini.setKeys(credsStr, 'default', LEGACY_CREDS_KEYS.reduce((acc, k) => { acc[k] = null; return acc }, {}))
}

/**
 * Lists profiles that use the legacy SSO format (sso_start_url inside the profile, no [sso-session]). Those
 * get a fixed-length session with no refresh token.
 */
const findLegacySsoProfiles = configStr => ini.listSections(configStr)
	.filter(s => s != 'default' && !s.startsWith('sso-session '))
	.filter(s => {
		const p = ini.getSection(configStr, s)
		return p.sso_start_url && !p.sso_session
	})
	.map(s => s.replace(/^profile\s+/, ''))

const normalizeUrl = url => (url || '').trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase()

/**
 * Derives an sso-session name from a start URL, e.g. 'https://acme.awsapps.com/start' -> 'acme'.
 */
const sessionNameFromUrl = url => {
	try {
		const { host, pathname } = new URL(url)
		const awsapps = host.match(/^([^.]+)\.awsapps\.com$/)
		if (awsapps)
			return awsapps[1]
		const ssoins = (pathname.match(/ssoins-[a-z0-9]+/i)||[])[0]
		if (ssoins)
			return ssoins.toLowerCase()
		return host.split('.')[0]
	} catch {
		return 'sso'
	}
}

/**
 * Converts legacy SSO profiles to the [sso-session] format. Profiles sharing the same start URL and SSO
 * region share one session, so one login covers them all. An existing [sso-session] with the same URL and
 * region is reused.
 *
 * @param  {String} configStr
 * @param  {Array}  names		Profile names to convert. Non-legacy names are ignored.
 * @param  {String} version
 * @return {Object} { config, sessions:[{ name, startUrl, region, created, profiles:[] }] }
 */
const upgradeLegacySsoProfiles = (configStr, names, version) => {
	const legacy = findLegacySsoProfiles(configStr).filter(n => names.includes(n))
	let config = configStr
	const sessions = []

	const existingSessions = () => ini.listSections(config)
		.filter(s => s.startsWith('sso-session '))
		.map(s => ({ name:s.replace(/^sso-session\s+/, ''), ...ini.getSection(config, s) }))

	for (const name of legacy) {
		const section = configSectionName(config, name)
		const p = ini.getSection(config, section)
		const startUrl = p.sso_start_url
		const region = p.sso_region

		let session = sessions.find(s => normalizeUrl(s.startUrl) == normalizeUrl(startUrl) && s.region == region)
		if (!session) {
			const existing = existingSessions().find(s => normalizeUrl(s.sso_start_url) == normalizeUrl(startUrl) && s.sso_region == region)
			if (existing)
				session = { name:existing.name, startUrl, region, created:false, profiles:[] }
			else {
				const base = sessionNameFromUrl(startUrl).replace(/[^a-zA-Z0-9_-]/g, '-') || 'sso'
				const taken = existingSessions().map(s => s.name)
				let sessionName = base
				for (let i=2; taken.includes(sessionName); i++)
					sessionName = `${base}-${i}`
				config = ini.setSection(config, `sso-session ${sessionName}`, [
					['sso_start_url', startUrl],
					['sso_region', region],
					['sso_registration_scopes', SSO_SCOPES],
					[VERSION_KEY, version]
				])
				session = { name:sessionName, startUrl, region, created:true, profiles:[] }
			}
			sessions.push(session)
		}

		config = ini.setKeys(config, section, {
			sso_start_url: null,
			sso_region: null,
			sso_session: session.name,
			[VERSION_KEY]: version
		})
		session.profiles.push(name)
	}

	return { config, sessions }
}

/**
 * Stamps a profile section with the CLI version that last wrote it.
 */
const stampProfile = (configStr, name, version) => {
	const section = configSectionName(configStr, name)
	return section ? ini.setKeys(configStr, section, { [VERSION_KEY]: version }) : configStr
}

/**
 * Reads every profile (excluding [default] and [sso-session] sections), resolving SSO settings that live in
 * a referenced [sso-session] section.
 */
const listProfiles = configStr => ini.listSections(configStr)
	.filter(s => s != 'default' && !s.startsWith('sso-session '))
	.map(s => {
		const params = ini.getSection(configStr, s)
		const session = params.sso_session ? (ini.getSection(configStr, `sso-session ${params.sso_session}`) || {}) : {}
		const p = {
			name: s.replace(/^profile\s+/, ''),
			sso_start_url: params.sso_start_url || session.sso_start_url || null,
			sso_region: params.sso_region || session.sso_region || null,
			sso_account_id: params.sso_account_id || null,
			sso_role_name: params.sso_role_name || null,
			sso_session: params.sso_session || null,
			region: params.region || null,
			output: params.output || null,
			version: params[VERSION_KEY] || null,
			accountName: params[ACCOUNT_NAME_KEY] || null,
			generated: params[GENERATED_KEY] || null,
			role_arn: params.role_arn || null,
			source_profile: params.source_profile || null,
			login_session: params.login_session || null
		}
		p.isSso = !!p.sso_start_url
		p.isLegacySso = p.isSso && !p.sso_session
		p.kind = p.isSso ? 'sso' : p.login_session ? 'login' : p.role_arn ? 'role' : params.credential_process ? 'process' : 'keys'
		if (!p.sso_account_id && p.role_arn)
			p.sso_account_id = (p.role_arn.match(/^arn:aws[^:]*:iam::(\d{12}):/) || [])[1] || null
		return p
	})

const slug = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * Pure: the profile name generated for an SSO account/role, e.g. 'acme-prod-workloads-admin'.
 */
const generatedProfileName = (prefix, accountName, accountId, roleName) =>
	[slug(prefix), slug(accountName) || accountId, slug(roleName)].filter(Boolean).join('-')

/**
 * Creates one profile per account/role available in an SSO portal, skipping account/role pairs that already
 * have a profile (whatever its name), and optionally removing profiles previously generated for this portal
 * that no longer exist.
 *
 * @param  {String}  configStr
 * @param  {String}  options.ssoSession		Name of the [sso-session] section
 * @param  {Array}   options.entries		[{ accountId, accountName, roleName }]
 * @param  {String}  options.region			Default region of the generated profiles
 * @param  {String}  options.prefix			Name prefix (defaults to the session name)
 * @param  {Boolean} options.prune			Remove stale generated profiles
 * @param  {String}  options.version
 * @return {Object}  { config, added:[names], existing:[names], stale:[names], removed:[names] }
 */
const populateSsoProfiles = (configStr, { ssoSession, entries, region, prefix, prune, version }) => {
	let config = configStr
	const profiles = listProfiles(config)
	const session = ini.getSection(config, `sso-session ${ssoSession}`) || {}
	const samePortal = p => p.sso_session == ssoSession || (p.sso_start_url && p.sso_start_url == session.sso_start_url)
	const key = (accountId, roleName) => `${accountId}/${roleName}`
	const byKey = new Map(profiles.filter(p => p.isSso && samePortal(p)).map(p => [key(p.sso_account_id, p.sso_role_name), p]))
	const taken = new Set(profiles.map(p => p.name))
	const wanted = new Set(entries.map(e => key(e.accountId, e.roleName)))

	const added = []
	const existing = []
	for (const e of entries) {
		const found = byKey.get(key(e.accountId, e.roleName))
		if (found) {
			existing.push(found.name)
			continue
		}
		const base = generatedProfileName(prefix || ssoSession, e.accountName, e.accountId, e.roleName)
		let name = base
		for (let i = 2; taken.has(name); i++)
			name = `${base}-${i}`
		taken.add(name)
		config = ini.setSection(config, `profile ${name}`, [
			['sso_session', ssoSession],
			['sso_account_id', e.accountId],
			['sso_role_name', e.roleName],
			...(region ? [['region', region]] : []),
			['output', 'json'],
			...(e.accountName ? [[ACCOUNT_NAME_KEY, e.accountName]] : []),
			[GENERATED_KEY, ssoSession],
			[VERSION_KEY, version]
		])
		added.push(name)
	}

	const stale = profiles.filter(p => p.generated == ssoSession && !wanted.has(key(p.sso_account_id, p.sso_role_name))).map(p => p.name)
	const removed = []
	if (prune) {
		for (const name of stale) {
			config = ini.removeSection(config, configSectionName(config, name))
			removed.push(name)
		}
	}
	return { config, added, existing, stale, removed }
}

/**
 * Lists the [sso-session] sections.
 */
const listSsoSessions = configStr => ini.listSections(configStr)
	.filter(s => s.startsWith('sso-session '))
	.map(s => ({ name:s.replace(/^sso-session\s+/, ''), ...ini.getSection(configStr, s) }))

/**
 * Adds an [sso-session] section (no-op if it already exists).
 */
const addSsoSession = (configStr, { name, startUrl, region, version }) => {
	if (ini.getSection(configStr, `sso-session ${name}`))
		return configStr
	return ini.setSection(configStr, `sso-session ${name}`, [
		['sso_start_url', startUrl],
		['sso_region', region],
		['sso_registration_scopes', SSO_SCOPES],
		[VERSION_KEY, version]
	])
}

module.exports = {
	GENERATED_KEY,
	ACCOUNT_NAME_KEY,
	generatedProfileName,
	populateSsoProfiles,
	listSsoSessions,
	addSsoSession,
	NAME_KEY,
	VERSION_KEY,
	configSectionName,
	setDefaultProfile,
	getDefaultProfileName,
	hasLegacyDefault,
	getLegacyDefaultProfileName,
	stripLegacyDefault,
	findLegacySsoProfiles,
	sessionNameFromUrl,
	upgradeLegacySsoProfiles,
	stampProfile,
	listProfiles
}

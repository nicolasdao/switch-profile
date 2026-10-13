/**
 * SSO portals ([sso-session] sections): list them, check their SSO region against what the portal says, and
 * edit the start URL or region in place. Also the region fix offered when a login fails because of the region.
 */
const p = require('@clack/prompts')
const aws = require('../aws')
const transforms = require('../aws/transforms')
const settings = require('../settings')
const ui = require('../ui')
const { ask, chooseRegion } = require('./common')
const { ssoLogin } = require('./login-flow')

const validateStartUrl = v => /^https:\/\/\S+$/.test(v || '') ? undefined : 'Enter the https:// start URL of the portal.'
const validateRegion = v => aws.regions.some(r => r.code == v) ? undefined : `Unknown region ${v}.`

const readConfig = async () => {
	const [errors, configStr] = await aws.getConfigFile()
	if (errors)
		throw ui.cliErrorFrom(errors)
	return configStr
}

/**
 * Every [sso-session] with the profiles that use it.
 *
 * @param  {Object}  state			From loadState()
 * @param  {Boolean} options.detect	Also read each portal's region from its start page (one request each)
 * @return {Array}					[{ name, startUrl, region, profiles:[name], detectedRegion }]
 */
const listPortals = async (state, { detect } = {}) => {
	const portals = transforms.listSsoSessions(await readConfig()).map(s => ({
		name: s.name,
		startUrl: s.sso_start_url || null,
		region: s.sso_region || null,
		profiles: state.profiles.filter(x => x.sso_session == s.name).map(x => x.name)
	}))
	if (detect)
		await Promise.all(portals.map(async x => { x.detectedRegion = x.startUrl ? await aws.detectSsoRegion(x.startUrl, { timeoutMs:4000 }) : null }))
	return portals
}

const findPortal = async (state, name) => {
	const portal = (await listPortals(state)).find(x => x.name == name)
	if (!portal)
		throw new ui.CliError(`There is no SSO portal named ${name}.`, { code:3, hint:'List them with: switch-profile portals' })
	return portal
}

// Pure: the portal page names a region other than the configured one.
const regionMismatch = (region, detectedRegion) => !!(detectedRegion && region && detectedRegion != region)

/**
 * Pure: one line about a portal's region, e.g. 'us-east-1 · ▲ its portal is in ap-southeast-2'.
 */
const regionNote = ({ region, detectedRegion }) => regionMismatch(region, detectedRegion) ? ui.join([region, ui.warn(`${ui.sym.warn} its portal is in ${detectedRegion}`)])
	: detectedRegion ? ui.join([region, ui.dim('matches the portal')])
		: region || ui.warn('no region')

const portalHint = x => ui.join([regionNote(x), `${x.profiles.length} profile${x.profiles.length == 1 ? '' : 's'}`, x.startUrl])

/**
 * Writes a new start URL and/or SSO region for a portal.
 */
const updatePortal = async (name, { startUrl, region }) => {
	const configStr = await readConfig()
	await aws.writeAwsFile(aws.AWS_CONFIG_FILE, transforms.updateSsoSession(configStr, { name, startUrl, region, version:settings.CLI_VERSION }))
}

/**
 * The edit page of one portal: shows its settings and what its portal page says, then lets the user fix the
 * region in one step or change the start URL or region. Every change is saved at once.
 *
 * @param  {Boolean} options.offerLogin	Offer a login to check the changes (off when the caller retries anyway)
 * @return {Object}	{ changed }
 */
const editPortal = async (name, state, { offerLogin = true, detectedRegion } = {}) => {
	let changed = false
	let detected = detectedRegion
	for (;;) {
		const portal = await findPortal(state, name)
		if (detected === undefined)
			detected = portal.startUrl ? await aws.detectSsoRegion(portal.startUrl) : null
		const mismatch = regionMismatch(portal.region, detected)
		p.log.info([
			ui.strong(`Portal ${name}`),
			`${ui.dim('Start URL ')}  ${portal.startUrl || ui.warn('missing')}`,
			`${ui.dim('SSO region')}  ${regionNote({ region:portal.region, detectedRegion:detected })}`,
			detected ? null : ui.dim('            (could not read the region from the portal page)'),
			`${ui.dim('Profiles  ')}  ${portal.profiles.length ? `${portal.profiles.slice(0, 4).join(', ')}${portal.profiles.length > 4 ? `, +${portal.profiles.length - 4} more` : ''}` : 'none'}`
		].filter(Boolean).join('\n'))
		const choice = await ask(p.select({
			message: `Edit ${name}`,
			options: [
				...(mismatch ? [{ value:'fix', label:`Change the SSO region to ${detected}`, hint:'what the portal page says' }] : []),
				{ value:'url', label:'Start URL', hint:portal.startUrl || undefined },
				{ value:'region', label:'SSO region', hint:portal.region || undefined },
				{ value:'done', label:changed ? 'Done' : 'Back' }
			]
		}))
		if (choice == 'done')
			break
		if (choice == 'fix') {
			await updatePortal(name, { region:detected })
			p.log.success(`${name} now uses the SSO region ${ui.accent(detected)}`)
		} else if (choice == 'url') {
			const startUrl = (await ask(p.text({ message:`Start URL of ${name}`, initialValue:portal.startUrl || '', validate:validateStartUrl }))).trim()
			if (startUrl == portal.startUrl)
				continue
			await updatePortal(name, { startUrl })
			detected = undefined
			p.log.success(`${name} now uses ${ui.accent(startUrl)}`)
		} else {
			const region = await chooseRegion(`SSO region of ${name} ${ui.dim('(where IAM Identity Center lives)')}`, detected || portal.region)
			if (region == portal.region)
				continue
			await updatePortal(name, { region })
			p.log.success(`${name} now uses the SSO region ${ui.accent(region)}`)
		}
		changed = true
	}
	if (changed && offerLogin && await ask(p.confirm({ message:`Log in to ${name} now to check it works?` })))
		await ssoLogin({ ssoSession:name }, { label:name, loginKey:name, interactive:true })
	return { changed }
}

/**
 * After a login failed because of the SSO region: proposes the region read from the portal, or lets the user
 * pick one. Saves and returns the new region; rethrows the login error when the user keeps the current one.
 */
const fixSsoRegion = async (session, loginError) => {
	const current = session.sso_region
	const detected = await aws.detectSsoRegion(session.sso_start_url)
	let region = null
	if (detected && detected != current) {
		p.log.warn(`${session.name} is set to the SSO region ${current}, but its portal is in ${detected}.`)
		if (await ask(p.confirm({ message:`Change ${session.name} to ${detected} and log in again?` })))
			region = detected
	} else
		p.log.warn(`AWS rejected the SSO region of ${session.name} (${current}). Pick the region where IAM Identity Center lives (Identity Center console › Settings).`)
	if (!region)
		region = await chooseRegion(`SSO region of ${session.name} ${ui.dim('(where IAM Identity Center lives)')}`, detected || current)
	if (region == current)
		throw loginError
	await updatePortal(session.name, { region })
	return region
}

module.exports = {
	validateStartUrl,
	validateRegion,
	listPortals,
	findPortal,
	regionMismatch,
	portalHint,
	updatePortal,
	editPortal,
	fixSsoRegion
}

/**
 * The error screen of the home screen. When a page or a switch fails, it says what failed and why, names the
 * SSO portal involved (start URL, configured region, the region its portal page names), and waits: fix the
 * region, edit the portal, try again or go back. Nothing returns to the home screen until the user chooses.
 */
const p = require('@clack/prompts')
const aws = require('../aws')
const transforms = require('../aws/transforms')
const ui = require('../ui')
const log = require('../log')
const { CancelError } = require('./common')
const portals = require('./portals')

/**
 * Pure: the [sso-session] a failed login was for, from the error's target ({ ssoSession } or { profile }).
 *
 * @param  {Error}  err
 * @param  {Array}  profiles	From loadState()
 * @param  {Array}  sessions	transforms.listSsoSessions()
 * @return {Object}				{ name, startUrl, region } or null
 */
const portalOfError = (err, profiles, sessions) => {
	const target = (err && err.target) || {}
	const name = target.ssoSession || (target.profile && ((profiles || []).find(x => x.name == target.profile) || {}).sso_session)
	const session = name && (sessions || []).find(s => s.name == name)
	return session ? { name:session.name, startUrl:session.sso_start_url || null, region:session.sso_region || null } : null
}

/**
 * Pure: the ways out of an error, most useful first.
 *
 * @param  {Object}  portal			{ name, region } or null
 * @param  {Boolean} wrongRegion	AWS answered as it does for a wrong SSO region
 * @param  {String}  detectedRegion	The region the portal page names, or null
 * @return {Array}					[{ value, label, hint }]
 */
const recoveryOptions = ({ portal, wrongRegion, detectedRegion }) => [
	portal && wrongRegion && portals.regionMismatch(portal.region, detectedRegion)
		? { value:'fix-region', label:`Change the SSO region of ${portal.name} to ${detectedRegion}`, hint:`currently ${portal.region}` } : null,
	portal ? { value:'edit-portal', label:`Edit the portal ${portal.name}`, hint:'start URL and SSO region' } : null,
	{ value:'retry', label:'Try again' },
	{ value:'back', label:'Back to the home screen' }
].filter(Boolean)

/**
 * Pure: the lines of the error panel.
 */
const errorLines = (err, { portal, detectedRegion }) => [
	ui.strong(err.message || String(err)),
	err.hint ? `\n${err.hint}` : null,
	portal ? `\n${ui.dim('Portal    ')}  ${portal.name}  ${ui.dim(portal.startUrl || '')}` : null,
	portal ? `${ui.dim('SSO region')}  ${portal.region || '?'}${portals.regionMismatch(portal.region, detectedRegion) ? `  ${ui.warn(`${ui.sym.warn} its portal page says ${detectedRegion}`)}` : detectedRegion ? `  ${ui.dim('(matches its portal page)')}` : ''}` : null,
	`\n${ui.dim(`Details: ${log.displayPath()}`)}`
].filter(v => v !== null).join('\n')

/**
 * Shows the error screen and acts on the choice.
 *
 * @param  {Error}  err		A CliError from a page or a switch
 * @param  {Object} state	From loadState()
 * @param  {String} what	For the log, e.g. 'switch to acme-prod'
 * @return {String}			'retry' (fixed or asked to try again) or 'back'
 */
const recover = async (err, state, what) => {
	log.error(`${what} failed (error screen)`, err)
	const [, configStr] = await aws.getConfigFile()
	const portal = portalOfError(err, state.profiles, transforms.listSsoSessions(configStr || ''))
	// The page lookup costs a request: only when the region is the likely cause.
	const detectedRegion = portal && err.wrongRegion && portal.startUrl ? await aws.detectSsoRegion(portal.startUrl) : null
	p.log.error(errorLines(err, { portal, detectedRegion }))

	const choice = await p.select({ message:'What now?', options:recoveryOptions({ portal, wrongRegion:err.wrongRegion, detectedRegion }) })
	if (p.isCancel(choice) || choice == 'back')
		return 'back'
	try {
		if (choice == 'fix-region') {
			await portals.updatePortal(portal.name, { region:detectedRegion })
			p.log.success(`${portal.name} now uses the SSO region ${ui.accent(detectedRegion)}. Trying again…`)
		} else if (choice == 'edit-portal') {
			const { changed } = await portals.editPortal(portal.name, state, { offerLogin:false, detectedRegion: err.wrongRegion ? detectedRegion : undefined })
			if (!changed)
				return 'back'
		}
	} catch(e) {
		if (e instanceof CancelError)
			return 'back'
		if (!(e instanceof ui.CliError))
			throw e
		log.error('fixing the portal failed', e)
		ui.printError(e)
		return 'back'
	}
	return 'retry'
}

module.exports = {
	portalOfError,
	recoveryOptions,
	recover
}

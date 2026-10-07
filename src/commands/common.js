/**
 * Shared plumbing for commands: prompt cancellation, the startup checks every command runs, and loading
 * the current state (profiles, default profile, settings).
 */
const p = require('@clack/prompts')
const log = require('../log')
const aws = require('../aws')
const settings = require('../settings')
const shell = require('../shell')
const migrate = require('../migrate')
const ui = require('../ui')

class CancelError extends Error {}

/**
 * Awaits a clack prompt and turns Ctrl+C/Esc into a CancelError.
 */
const ask = async promise => {
	const value = await promise
	if (p.isCancel(value))
		throw new CancelError('Cancelled')
	return value
}

const INSTALL_HINTS = {
	darwin: 'Install it with: brew install awscli',
	win32: 'Download it from https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html',
	linux: 'Install it from https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html'
}

/**
 * Runs before every command: checks the AWS CLI, runs the automatic migrations, offers the one-time legacy
 * SSO upgrade (interactive only) and keeps the 'sp' shell block current.
 *
 * @param  {Boolean} options.interactive
 * @param  {Boolean} options.quiet			No output (e.g., --json)
 */
const preflight = async ({ interactive, quiet }) => {
	const [cliErrors, cliExists] = await aws.awsCliV2Exists(true)
	if (cliErrors)
		throw ui.cliErrorFrom(cliErrors, { hint:'switch-profile needs AWS CLI v2.' })
	if (!cliExists)
		throw new ui.CliError('The AWS CLI is not installed.', { hint: INSTALL_HINTS[process.platform] || INSTALL_HINTS.linux })

	let result
	try {
		result = await migrate.runMigrations()
	} catch(err) {
		if (err instanceof migrate.NewerFormatError)
			throw new ui.CliError(err.message, { cause:err })
		throw err
	}
	if (result.migrated && !quiet)
		p.log.info([
			`Upgraded your AWS setup for switch-profile ${settings.CLI_VERSION} ${ui.unicode ? '🎉' : ''}`,
			ui.dim(`[default] now holds ${result.defaultProfile ? `${result.defaultProfile}'s` : 'the profile\'s'} settings instead of copied keys, so credentials refresh on their own.`),
			ui.dim(`Backups: ${result.backups.join(', ')}`)
		].join('\n'))

	if (interactive) {
		const current = await settings.read()
		if (!current.ssoUpgradeDeclined) {
			const legacy = await migrate.findLegacySsoProfiles()
			if (legacy.length) {
				p.log.warn(`${legacy.length > 1 ? `${legacy.length} profiles use` : '1 profile uses'} the old SSO format, which never auto-refreshes: ${legacy.join(', ')}`)
				const upgrade = await ask(p.confirm({ message:'Upgrade them now? You\'ll log in once per SSO portal.' }))
				if (upgrade)
					await upgradeLegacySso(legacy)
				else {
					await settings.update({ ssoUpgradeDeclined:true })
					p.log.message(ui.dim('No problem. You can upgrade later from Settings.'))
				}
			}
		}
	}

	const status = await shell.getStatus(settings.CLI_VERSION).catch(log.tolerated('reading the sp shortcut status', null))
	if (status && status.installed && status.outdated) {
		const updated = await shell.install(settings.CLI_VERSION).then(() => true, () => false)
		if (updated && !quiet)
			p.log.info(`Updated the ${ui.accent(shell.FUNCTION_NAME)} shortcut in ${status.shell.files.map(shell.tilde).join(', ')} ${ui.dim('(new terminals pick it up)')}`)
	}
}

const upgradeLegacySso = async names => {
	const { sessions, backups } = await migrate.upgradeLegacySsoProfiles(names)
	p.log.success([
		`Upgraded ${names.length} profile${names.length > 1 ? 's' : ''} to auto-refresh`,
		...sessions.map(s => ui.dim(`  [sso-session ${s.name}] ${s.profiles.join(', ')}`)),
		ui.dim(`Backups: ${backups.join(', ')}`)
	].join('\n'))
}

/**
 * @return {Object} { profiles, defaultName, defaultProfile, settings }
 */
const loadState = async () => {
	const [listErrors, profiles] = await aws.listProfiles()
	if (listErrors)
		throw ui.cliErrorFrom(listErrors)
	const [defaultErrors, info] = await aws.getDefaultProfile()
	if (defaultErrors)
		throw ui.cliErrorFrom(defaultErrors)
	const defaultProfile = profiles.find(x => x.name == info.profile) || null
	return { profiles, defaultName: defaultProfile ? defaultProfile.name : null, defaultProfile, settings: await settings.read() }
}

const loginKey = profile => profile.sso_session || profile.sso_start_url || profile.name

/**
 * One-line description of a profile: role · account · region.
 */
const describe = (profile, identity) => ui.join([
	(identity && identity.roleName) || profile.sso_role_name || (profile.kind == 'keys' ? 'access keys' : profile.kind == 'login' ? 'console sign-in' : null),
	(identity && identity.account) || profile.sso_account_id,
	profile.region
])

/**
 * Describes the login state of an SSO profile, e.g. "SSO ✓ auto-refresh · logged in 3h ago".
 *
 * @return {Object} { text, needsLogin }
 */
const loginState = async (profile, state) => {
	if (profile.kind != 'sso')
		return { text: null, needsLogin:false }
	const [, login] = await aws.getSsoLoginStatus(profile.sso_start_url)
	const at = ((state && state.settings.logins) || {})[loginKey(profile)]
	const since = at ? ui.dim(`logged in ${ui.ago(at)}`) : null
	const s = login ? login.state : 'none'
	if (s == 'refreshable')
		return { text: ui.join([ui.ok(`SSO ${ui.sym.ok}`) + ' auto-refresh', since]), needsLogin:false }
	if (s == 'active')
		return { text: ui.join([ui.ok(`SSO ${ui.sym.ok}`) + ` ${Math.round((login.expiresAt - Date.now()) / 60000)} min left`, since]), needsLogin:false }
	return { text: ui.warn(s == 'expired' ? 'SSO login expired' : 'not logged in'), needsLogin:true }
}

module.exports = {
	CancelError,
	ask,
	preflight,
	upgradeLegacySso,
	loadState,
	loginKey,
	describe,
	loginState
}

/**
 * The main flow: status line, searchable picker, login when needed, identity check, then the default profile
 * and (through the 'sp' shortcut) this terminal switch to the chosen profile.
 */
const p = require('@clack/prompts')
const aws = require('../aws')
const settings = require('../settings')
const shell = require('../shell')
const rank = require('../rank')
const ui = require('../ui')
const { ask, preflight, loadState, loginKey, describe, loginState } = require('./common')
const { ssoLogin } = require('./login-flow')

const ACTION = '__action__:'

const header = async state => {
	p.intro(`${ui.badge('switch-profile')} ${ui.dim(settings.CLI_VERSION)}`)
	const lines = []
	if (state.defaultProfile) {
		const login = await loginState(state.defaultProfile, state)
		lines.push(ui.join([
			`${ui.accent(ui.sym.dot)} ${ui.strong(state.defaultProfile.name)}`,
			describe(state.defaultProfile),
			rank.isProd(state.defaultProfile) ? ui.prodBadge() : null,
			login.text
		]))
		state.needsLogin = login.needsLogin
	} else
		lines.push(ui.dim('No default profile yet. Pick one below.'))

	const terminal = process.env.AWS_PROFILE
	if (terminal && terminal != state.defaultName)
		lines.push(`${ui.dim('This terminal uses')} ${ui.accent(terminal)} ${ui.dim('(AWS_PROFILE)')}`)
	p.log.message(lines.join('\n'))
	warnEnv()
}

/**
 * Warns about environment variables that override the selected profile.
 */
const warnEnv = () => {
	const set = shell.CLEARED_VARS.filter(v => process.env[v])
	if (!set.length)
		return
	const viaShortcut = !!process.env.SWITCH_PROFILE_SHELL
	p.log.warn(`${set.join(', ')} ${set.length > 1 ? 'are' : 'is'} set in this terminal and override${set.length > 1 ? '' : 's'} profiles.\n${ui.dim(viaShortcut ? 'Switching clears them from this terminal.' : `Unset ${set.length > 1 ? 'them' : 'it'}, or switch with ${shell.FUNCTION_NAME} to clear ${set.length > 1 ? 'them' : 'it'} automatically.`)}`)
}

const ACTIONS = [
	{ key:'add', icon:'+', label:'Add profiles', hint:'import accounts from an SSO portal, or create one' },
	{ key:'login', icon:'↻', label:'Log in again', hint:'start a fresh SSO session for the current profile' },
	{ key:'remove', icon:'−', label:'Remove profiles' },
	{ key:'logout', icon:'⏻', label:'Log out', hint:'end every SSO session on this machine' },
	{ key:'settings', icon:'⚙', label:'Settings' }
]

const buildRows = (profiles, state) => {
	const cols = ui.columns()
	const showRole = cols >= 80
	const showRegion = cols >= 100
	const roleOf = x => x.sso_role_name || (x.kind == 'keys' ? 'access keys' : x.kind == 'login' ? 'console sign-in' : x.kind)
	const all = state.profiles
	const nameWidth = Math.min(Math.max(...all.map(x => x.name.length), 8), 32)
	const roleWidth = Math.min(Math.max(0, ...all.map(x => roleOf(x).length)), 22)
	const usage = state.settings.usage || {}
	return profiles.map(x => {
		const label = [
			ui.fit(x.name, nameWidth),
			showRole ? ui.dim(ui.fit(roleOf(x), roleWidth)) : null,
			ui.dim(ui.fit(x.sso_account_id || '', 12)),
			showRegion ? ui.dim(ui.fit(x.region || '', 14)) : null,
			rank.isProd(x) ? ui.prodBadge() : null
		].filter(v => v !== null).join('  ').trimEnd()
		const hint = x.name == state.defaultName ? 'current default'
			: [x.accountName, usage[x.name] ? `used ${ui.ago(usage[x.name].last)}` : null].filter(Boolean).join(' · ')
		return { value:x.name, label, hint: hint || undefined }
	})
}

/**
 * Shows the picker. Resolves with a profile name, or an action key prefixed with ACTION.
 */
const pick = async (state, initialQuery) => {
	const actions = ACTIONS.map(a => ({ value:ACTION + a.key, label:`${ui.accent(ui.unicode ? a.icon : '>')} ${a.label}`, hint:a.hint, text:a.label.toLowerCase() }))
	const maxItems = Math.max(5, Math.min(14, (process.stdout.rows || 24) - 10))
	return ask(p.autocomplete({
		message: `Switch to ${ui.dim('· type a name, account, role or client')}`,
		maxItems,
		initialUserInput: initialQuery || undefined,
		// Rows are already filtered and ranked below; clack would otherwise re-filter them by substring.
		filter: () => true,
		options() {
			const query = this.userInput || ''
			const ranked = rank.rankProfiles(state.profiles, { query, usage:state.settings.usage, current:state.defaultName })
			const q = query.trim().toLowerCase()
			const matchingActions = actions.filter(a => !q || a.text.includes(q)).map(a => ({ value:a.value, label:a.label, hint:a.hint }))
			return [...buildRows(ranked, state), ...matchingActions]
		}
	}))
}

/**
 * Connects to a profile: checks the identity it resolves to, logging in first when needed.
 *
 * @return {Object} identity { account, arn, roleName }
 */
const connect = async (profile, state, { interactive, quiet, force }) => {
	const spin = quiet ? null : ui.spinner()
	const tryIdentity = async () => {
		if (spin)
			spin.start(`Connecting to ${profile.name}`)
		try {
			const identity = await aws.callerIdentity(profile.name)
			if (spin)
				spin.clear()
			return identity
		} catch(err) {
			if (spin)
				spin.clear()
			return err
		}
	}

	let result = force ? new Error('forced login') : await tryIdentity()
	if (!(result instanceof Error))
		return result

	const loginProfile = profile.kind == 'role' && profile.source_profile ? state.profiles.find(x => x.name == profile.source_profile) : profile
	const canLogin = loginProfile && (loginProfile.kind == 'sso' || loginProfile.kind == 'login')
	if (!canLogin)
		throw new ui.CliError(`Could not get credentials for ${profile.name}.`, { hint: firstLine(result.message) })
	if (!interactive && !force)
		throw new ui.CliError(`${profile.name} needs a login.`, { code:2, hint:`Run: switch-profile login ${loginProfile.name}` })

	if (loginProfile.kind == 'sso')
		await ssoLogin({ profile:loginProfile.name }, { label:loginProfile.sso_session || loginProfile.name, loginKey:loginKey(loginProfile), interactive })
	else
		await aws.awsLogin(loginProfile.name)

	result = await tryIdentity()
	if (result instanceof Error)
		throw new ui.CliError(`Logged in, but ${profile.name} still has no access.`, { hint: firstLine(result.message) })
	return result
}

const firstLine = text => String(text || '').trim().split('\n').filter(Boolean).slice(-1)[0]

/**
 * Switches to a profile and reports what happened.
 */
const switchTo = async (profile, state, opts) => {
	const { interactive, json } = opts
	const identity = await connect(profile, state, { interactive, quiet:json, force:opts.force })

	const [defaultErrors] = await aws.setDefaultProfile(profile.name)
	if (defaultErrors)
		throw new ui.CliError(ui.errorsMessage(defaultErrors))
	const current = await settings.read()
	await settings.update({ usage: rank.recordUsage(current.usage, profile.name) })
	const terminal = await shell.exportProfile(profile.name).catch(() => false)

	if (json) {
		process.stdout.write(JSON.stringify({ profile:profile.name, account:identity.account, arn:identity.arn, region:profile.region || null, default:true, terminal }) + '\n')
		return
	}

	if (profile.sso_account_id && identity.account && profile.sso_account_id != identity.account)
		p.log.warn(`${profile.name} is configured for account ${profile.sso_account_id} but resolved to ${identity.account}.`)
	if (rank.isProd(profile))
		p.log.warn(`${ui.unicode ? '🔥 ' : ''}${ui.bad('Production account.')} Careful out there.`)
	const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
	if (region && profile.region && region != profile.region)
		p.log.warn(`${process.env.AWS_REGION ? 'AWS_REGION' : 'AWS_DEFAULT_REGION'}=${region} overrides this profile's region (${profile.region}).`)

	const summary = ui.join([ui.strong(profile.name), describe(profile, identity)])
	if (terminal) {
		const cleared = shell.CLEARED_VARS.filter(v => process.env[v])
		p.outro(`${ui.ok(ui.sym.ok)} ${summary}\n   ${ui.dim(`this terminal now uses it${cleared.length ? ` (cleared ${cleared.join(', ')})` : ''}`)} ${ui.unicode ? '🎯' : ''}`)
		return
	}
	p.log.success(`${summary}\n${ui.dim('set as the default profile')}`)
	await offerShortcut(profile)
}

const exportHint = name => process.platform == 'win32'
	? `$env:AWS_PROFILE = "${name}"   ${ui.dim('(PowerShell)')}\n   set AWS_PROFILE=${name}   ${ui.dim('(CMD)')}`
	: `export AWS_PROFILE=${name}`

/**
 * After a switch without the 'sp' shortcut: explains how to scope the profile to this terminal, and offers
 * (once) to install the shortcut.
 */
const offerShortcut = async profile => {
	const status = await shell.getStatus(settings.CLI_VERSION).catch(() => null)
	const hint = `${ui.dim('To use it in this terminal only, run:')}\n   ${ui.accent(exportHint(profile.name))}`
	if (status && status.installed) {
		p.outro(`${hint}\n${ui.dim(`Tip: switch with ${ui.accent(shell.FUNCTION_NAME)} and this happens automatically. Not found? Run ${status.shell.reload} or open a new terminal.`)}`)
		return
	}
	const current = await settings.read()
	if (!status || !status.supported || current.perTerminalPrompted) {
		p.outro(`${hint}${status && status.supported ? `\n${ui.dim('Tip: enable per-terminal switching in Settings.')}` : ''}`)
		return
	}
	p.log.message(hint)
	const enable = await ask(p.confirm({
		message: `Set up the ${shell.FUNCTION_NAME} shortcut? It switches this terminal automatically and adds tab-completion ${ui.dim(`(adds a few lines to ${status.shell.files.map(shell.tilde).join(', ')})`)}`
	}))
	await settings.update({ perTerminalPrompted:true })
	if (!enable) {
		p.outro(ui.dim('No problem. You can enable it later in Settings.'))
		return
	}
	await enableShortcut()
	p.outro(`Next time, just type ${ui.accent(`${shell.FUNCTION_NAME}`)} ${ui.dim(`or ${shell.FUNCTION_NAME} <name>`)} ${ui.unicode ? '⚡' : ''}`)
}

const enableShortcut = async () => {
	const installed = await shell.install(settings.CLI_VERSION)
	p.log.success(`Added ${ui.accent(shell.FUNCTION_NAME)} to ${installed.files.map(shell.tilde).join(', ')}\n${ui.dim(`Open a new terminal or run: ${installed.reload}`)}`)
	if (installed.name == 'powershell')
		p.log.message(ui.dim('If PowerShell refuses to load your profile: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned'))
}

const runAction = async (key, state, opts) => {
	const commands = require('./index')
	if (key == 'login')
		return commands.login(state.defaultName, { ...opts, fromPicker:true })
	return commands[key](opts.args || [], { ...opts, fromPicker:true })
}

/**
 * Default command: 'switch-profile [query]'.
 */
const switchCommand = async (query, opts) => {
	const interactive = ui.isInteractive(opts)
	await preflight({ interactive, quiet:opts.json })
	const state = await loadState()

	if (!state.profiles.length) {
		if (!interactive)
			throw new ui.CliError('There are no AWS profiles yet.', { code:3, hint:'Run switch-profile add in a terminal to create one.' })
		p.intro(`${ui.badge('switch-profile')} ${ui.dim(settings.CLI_VERSION)}`)
		p.log.message(`No AWS profiles yet. Let's add your first one ${ui.unicode ? '✨' : ''}`)
		return require('./index').add([], { ...opts, fromPicker:true })
	}

	if (query) {
		const { profile, candidates } = rank.resolveQuery(state.profiles, query, { usage:state.settings.usage, current:state.defaultName })
		if (profile) {
			if (!opts.json && interactive)
				p.intro(`${ui.badge('switch-profile')} ${ui.dim(settings.CLI_VERSION)}`)
			return switchTo(profile, state, { ...opts, interactive })
		}
		if (!interactive) {
			throw new ui.CliError(candidates.length ? `"${query}" matches ${candidates.length} profiles.` : `No profile matches "${query}".`, {
				code:3,
				hint: candidates.length ? `Be more specific: ${candidates.slice(0, 5).map(x => x.name).join(', ')}${candidates.length > 5 ? ', …' : ''}` : 'List them with: switch-profile status --json'
			})
		}
	} else if (!interactive)
		throw new ui.CliError('Which profile? Pass its name.', { code:3, hint:`e.g. switch-profile ${state.profiles[0].name}` })

	await header(state)
	const choice = await pick(state, query)
	if (choice.startsWith(ACTION))
		return runAction(choice.slice(ACTION.length), state, { ...opts, interactive })
	return switchTo(state.profiles.find(x => x.name == choice), state, { ...opts, interactive })
}

module.exports = {
	switchCommand,
	switchTo,
	connect,
	enableShortcut,
	exportHint
}

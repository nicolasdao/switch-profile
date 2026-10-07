/**
 * Every command except the default switch flow (see ./switch.js).
 */
const p = require('@clack/prompts')
const aws = require('../aws')
const transforms = require('../aws/transforms')
const settings = require('../settings')
const shell = require('../shell')
const migrate = require('../migrate')
const rank = require('../rank')
const { resolveLoginMode, isRemoteSession } = require('../aws/login')
const ui = require('../ui')
const { ask, preflight, loadState, loginKey, describe, loginState, upgradeLegacySso } = require('./common')
const { ssoLogin, rememberLogin } = require('./login-flow')
const { switchCommand, switchTo, connect, enableShortcut } = require('./switch')

const intro = opts => {
	if (!opts.fromPicker && !opts.json)
		p.intro(`${ui.badge('switch-profile')} ${ui.dim(settings.CLI_VERSION)}`)
}

const begin = async (opts, { needsInput } = {}) => {
	const interactive = ui.isInteractive(opts)
	if (needsInput && !interactive)
		throw new ui.CliError('This command is interactive.', { code:3, hint:'Run it in a terminal.' })
	if (!opts.fromPicker)
		await preflight({ interactive, quiet:opts.json })
	intro(opts)
	return interactive
}

const findProfile = (state, name) => {
	const profile = state.profiles.find(x => x.name == name)
	if (!profile)
		throw new ui.CliError(`Profile ${name} does not exist.`, { code:3, hint:`Available: ${state.profiles.slice(0, 8).map(x => x.name).join(', ')}${state.profiles.length > 8 ? ', …' : ''}` })
	return profile
}

/**
 * 'switch-profile use <profile>': switch without any fuzzy matching.
 */
const use = async (name, opts) => {
	const interactive = ui.isInteractive(opts)
	await preflight({ interactive, quiet:opts.json })
	const state = await loadState()
	if (interactive && !opts.json)
		intro(opts)
	return switchTo(findProfile(state, name), state, { ...opts, interactive })
}

/**
 * 'switch-profile status [--json]'
 */
const status = async (args, opts) => {
	await begin(opts)
	const state = await loadState()
	const terminal = process.env.AWS_PROFILE || null
	const shortcut = await shell.getStatus(settings.CLI_VERSION).catch(() => null)
	const d = state.defaultProfile
	const login = d ? await loginState(d, state) : { text:null, needsLogin:false }

	if (opts.json) {
		const at = d ? (state.settings.logins || {})[loginKey(d)] : null
		process.stdout.write(JSON.stringify({
			default: d ? { name:d.name, kind:d.kind, account:d.sso_account_id, role:d.sso_role_name, region:d.region, sso_session:d.sso_session, prod:rank.isProd(d), needsLogin:login.needsLogin, loggedInAt:at || null } : null,
			terminal,
			shortcut: shortcut ? { installed:shortcut.installed, active:shortcut.active, shell:shortcut.shell.name } : null,
			profiles: state.profiles.map(x => ({ name:x.name, kind:x.kind, account:x.sso_account_id, role:x.sso_role_name, region:x.region, sso_session:x.sso_session, prod:rank.isProd(x) }))
		}, null, 2) + '\n')
		return
	}

	const lines = d
		? [ui.join([`${ui.accent(ui.sym.dot)} ${ui.strong(d.name)}`, ui.dim('default')]), `  ${ui.join([describe(d), rank.isProd(d) ? ui.prodBadge() : null])}`, ...(login.text ? [`  ${login.text}`] : [])]
		: [ui.dim('No default profile yet.')]
	if (terminal && terminal != state.defaultName)
		lines.push(`${ui.dim('This terminal uses')} ${ui.accent(terminal)}`)
	lines.push(ui.dim(`${state.profiles.length} profile${state.profiles.length == 1 ? '' : 's'} · per-terminal switching ${shortcut && shortcut.installed ? 'on' : 'off'}`))
	p.log.message(lines.join('\n'))
	p.outro(login.needsLogin ? ui.warn(`Run ${shell.FUNCTION_NAME} login to log in again.`) : ui.dim('All good.'))
}

/**
 * 'switch-profile login [profile] [--device|--browser]': starts a fresh session now, even if the current one
 * is still valid.
 */
const login = async (name, opts) => {
	const interactive = await begin(opts)
	const state = await loadState()
	const target = name || (opts.fromPicker ? state.defaultName : process.env.AWS_PROFILE || state.defaultName)
	if (!target)
		throw new ui.CliError('Which profile? There is no default profile yet.', { code:3, hint:'Run: switch-profile login <profile>' })
	const profile = findProfile(state, target)
	if (profile.kind == 'keys' || profile.kind == 'process')
		throw new ui.CliError(`${profile.name} uses ${profile.kind == 'keys' ? 'access keys' : 'a credential process'}: there is nothing to log in to.`, { code:3 })

	const loginMode = opts.device ? 'device' : opts.browser ? 'browser' : undefined
	if (profile.kind == 'sso')
		await ssoLogin({ profile:profile.name }, { label:profile.sso_session || profile.name, loginKey:loginKey(profile), interactive, loginMode })
	else {
		await connect(profile, state, { interactive, quiet:opts.json, force:true })
		await rememberLogin(loginKey(profile))
	}
	const identity = await connect(profile, state, { interactive, quiet:opts.json })
	if (opts.json)
		process.stdout.write(JSON.stringify({ profile:profile.name, account:identity.account, arn:identity.arn }) + '\n')
	else
		p.outro(`${ui.ok(ui.sym.ok)} ${ui.join([ui.strong(profile.name), describe(profile, identity)])}`)
}

/**
 * 'switch-profile logout [--yes]'
 */
const logout = async (args, opts) => {
	const interactive = await begin(opts)
	if (!opts.yes) {
		if (!interactive)
			throw new ui.CliError('Logging out needs confirmation.', { code:3, hint:'Run: switch-profile logout --yes' })
		const sure = await ask(p.confirm({ message:'Log out of every SSO session on this machine?', initialValue:false }))
		if (!sure)
			return p.outro(ui.dim('Nothing changed.'))
	}
	await aws.logoutAll()
	await settings.update({ logins:{} })
	p.outro(`${ui.ok(ui.sym.ok)} Logged out ${ui.unicode ? '👋' : ''}${isRemoteSession(process.env, process.platform) ? ui.dim(' This machine no longer has AWS access.') : ''}`)
}

const chooseRegion = async (message, initialValue) => ask(p.autocomplete({
	message,
	maxItems: 8,
	initialValue,
	options: aws.regions.map(r => ({ value:r.code, label:r.code, hint:r.name }))
}))

const validateProfileName = taken => value => {
	if (!value)
		return 'A name is required.'
	if (!/^[a-z0-9][a-z0-9_-]+$/.test(value))
		return 'Use lowercase letters, numbers, - and _ (at least 2 characters).'
	if (taken.includes(value))
		return `${value} already exists.`
}

/**
 * 'switch-profile add [--from-sso <session>]'
 */
const add = async (args, opts) => {
	const interactive = await begin(opts, { needsInput: !opts.fromSso })
	const state = await loadState()
	if (opts.fromSso)
		return importFromSso(state, { ...opts, interactive })

	const kind = await ask(p.select({
		message: 'What would you like to add?',
		options: [
			{ value:'import', label:'Accounts from an SSO portal', hint:'recommended: one profile per account and role, in one go' },
			{ value:'sso', label:'A single SSO profile', hint:'guided by aws configure sso' },
			{ value:'login', label:'Console sign-in', hint:'aws login: IAM users and roles, no access keys' },
			{ value:'keys', label:'Access keys', hint:'not recommended' }
		]
	}))
	if (kind == 'import')
		return importFromSso(state, { ...opts, interactive })

	const taken = state.profiles.map(x => x.name)
	const name = await ask(p.text({ message:'Profile name', placeholder:'e.g. acme-prod', validate:validateProfileName(taken) }))

	if (kind == 'sso') {
		p.log.message([
			'Handing over to aws configure sso. You will be asked for:',
			`${ui.dim('1.')} a session name ${ui.dim('(reuse the same one for every profile of a portal: one login covers them all)')}`,
			`${ui.dim('2.')} the start URL ${ui.dim('(e.g. https://acme.awsapps.com/start)')}`,
			`${ui.dim('3.')} the SSO region ${ui.dim('(where IAM Identity Center lives, not where you deploy)')}`
		].join('\n'))
		const [errors, upgraded] = await aws.createSsoProfile(name)
		if (errors)
			throw new ui.CliError(ui.errorsMessage(errors))
		if (upgraded)
			p.log.info(`No session name was given, so ${name} now uses an [sso-session] for auto-refresh. You'll log in once more.`)
	} else if (kind == 'login') {
		const region = await chooseRegion('Default region', 'us-east-1')
		const [configErrors, configStr] = await aws.getConfigFile()
		if (configErrors)
			throw new ui.CliError(ui.errorsMessage(configErrors))
		const ini = require('../ini')
		await aws.writeAwsFile(aws.AWS_CONFIG_FILE, ini.setSection(configStr, `profile ${name}`, [['region', region], [transforms.VERSION_KEY, settings.CLI_VERSION]]))
		p.log.step('Signing in with aws login…')
		await aws.awsLogin(name)
	} else {
		p.log.warn('Access keys never expire and are stored in plain text in ~/.aws/credentials.\nAWS recommends SSO or console sign-in instead.')
		if (!await ask(p.confirm({ message:'Continue with access keys anyway?', initialValue:false })))
			return p.outro(ui.dim('Nothing changed.'))
		const aws_access_key_id = await ask(p.text({ message:'Access key ID', validate: v => v ? undefined : 'Required.' }))
		const aws_secret_access_key = await ask(p.password({ message:'Secret access key', validate: v => v ? undefined : 'Required.' }))
		const region = await chooseRegion('Default region', 'us-east-1')
		const [errors] = await aws.createProfile({ name, aws_access_key_id, aws_secret_access_key, region })
		if (errors)
			throw new ui.CliError(ui.errorsMessage(errors))
	}

	p.log.success(`Profile ${ui.accent(name)} created`)
	const next = await loadState()
	if (await ask(p.confirm({ message:`Switch to ${name} now?` })))
		return switchTo(findProfile(next, name), next, { ...opts, interactive })
	p.outro(`Switch to it any time with ${ui.accent(`${shell.FUNCTION_NAME} ${name}`)}`)
}

const mapLimit = async (items, limit, fn) => {
	const results = new Array(items.length)
	let next = 0
	await Promise.all(Array.from({ length:Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const i = next++
			results[i] = await fn(items[i], i)
		}
	}))
	return results
}

/**
 * Creates one profile per account/role of an SSO portal.
 */
const importFromSso = async (state, opts) => {
	const { interactive } = opts
	let [configErrors, configStr] = await aws.getConfigFile()
	if (configErrors)
		throw new ui.CliError(ui.errorsMessage(configErrors))
	const sessions = transforms.listSsoSessions(configStr)

	let sessionName = opts.fromSso && opts.fromSso !== true ? opts.fromSso : null
	if (sessionName && !sessions.some(s => s.name == sessionName))
		throw new ui.CliError(`There is no [sso-session ${sessionName}] in ~/.aws/config.`, { code:3, hint: sessions.length ? `Known sessions: ${sessions.map(s => s.name).join(', ')}` : 'Run switch-profile add in a terminal to add a portal.' })
	if (!sessionName) {
		if (!interactive)
			throw new ui.CliError('Which SSO portal?', { code:3, hint:'Pass --from-sso <session>.' })
		const choice = sessions.length ? await ask(p.select({
			message: 'Which SSO portal?',
			options: [
				...sessions.map(s => ({ value:s.name, label:s.name, hint:s.sso_start_url })),
				{ value:'__new__', label:'A new portal…' }
			]
		})) : '__new__'
		if (choice == '__new__') {
			const startUrl = await ask(p.text({ message:'SSO start URL', placeholder:'https://acme.awsapps.com/start', validate: v => /^https:\/\/\S+$/.test(v || '') ? undefined : 'Enter the https:// start URL of the portal.' }))
			const region = await chooseRegion(`SSO region ${ui.dim('(where IAM Identity Center lives)')}`, 'us-east-1')
			const suggested = transforms.sessionNameFromUrl(startUrl).replace(/[^a-zA-Z0-9_-]/g, '-')
			sessionName = await ask(p.text({ message:`Short name for this portal ${ui.dim('(usually the client)')}`, initialValue:suggested, validate: v => !/^[a-zA-Z0-9_-]+$/.test(v || '') ? 'Letters, numbers, - and _ only.' : sessions.some(s => s.name == v) ? `${v} already exists.` : undefined }))
			configStr = transforms.addSsoSession(configStr, { name:sessionName, startUrl, region, version:settings.CLI_VERSION })
			await aws.writeAwsFile(aws.AWS_CONFIG_FILE, configStr)
		} else
			sessionName = choice
	}
	const session = transforms.listSsoSessions(configStr).find(s => s.name == sessionName)

	let token = await aws.readSsoToken({ ssoSession:sessionName })
	if (!token) {
		if (!interactive)
			throw new ui.CliError(`Not logged in to ${sessionName}.`, { code:2, hint:`Run: aws sso login --sso-session ${sessionName}` })
		await ssoLogin({ ssoSession:sessionName }, { label:sessionName, loginKey:sessionName, interactive })
		token = await aws.readSsoToken({ ssoSession:sessionName })
		if (!token)
			throw new ui.CliError(`Logged in, but no token was found for ${sessionName}.`)
	}

	const spin = opts.json ? null : ui.spinner()
	if (spin)
		spin.start(`Reading the accounts of ${sessionName}`)
	let entries
	try {
		const accounts = await aws.listSsoAccounts(token.accessToken, session.sso_region)
		let done = 0
		const roles = await mapLimit(accounts, 6, async a => {
			const r = await aws.listSsoRoles(token.accessToken, session.sso_region, a.accountId)
			if (spin)
				spin.message(`Reading roles ${++done}/${accounts.length}`)
			return r
		})
		entries = accounts.flatMap((a, i) => roles[i].map(roleName => ({ ...a, roleName })))
		if (spin)
			spin.stop(`Found ${accounts.length} account${accounts.length == 1 ? '' : 's'} and ${entries.length} role${entries.length == 1 ? '' : 's'}`)
	} catch(err) {
		if (spin)
			spin.error('Could not read the accounts')
		throw new ui.CliError(`Could not list the accounts of ${sessionName}.`, { hint:String(err.message).trim().split('\n').slice(-1)[0] })
	}

	const sessionRegions = state.profiles.filter(x => x.sso_session == sessionName && x.region).map(x => x.region)
	const region = opts.region || (interactive ? await chooseRegion('Default region for these profiles', sessionRegions[0] || session.sso_region) : session.sso_region)
	const prefix = opts.prefix || (interactive ? await ask(p.text({ message:`Name prefix ${ui.dim('(profiles become <prefix>-<account>-<role>)')}`, initialValue:sessionName, validate: v => /^[a-z0-9_-]*$/.test(v || '') ? undefined : 'Lowercase letters, numbers, - and _ only.' })) : sessionName)

	const preview = transforms.populateSsoProfiles(configStr, { ssoSession:sessionName, entries, region, prefix, prune:false, version:settings.CLI_VERSION })
	if (!preview.added.length && !preview.stale.length) {
		if (opts.json)
			return process.stdout.write(JSON.stringify({ added:[], existing:preview.existing, removed:[], stale:[] }) + '\n')
		return p.outro(`${ui.ok(ui.sym.ok)} Everything is already set up ${ui.dim(`(${preview.existing.length} profiles)`)}`)
	}

	const summary = [
		preview.added.length ? `${ui.ok(`+${preview.added.length}`)} new: ${preview.added.slice(0, 6).join(', ')}${preview.added.length > 6 ? ', …' : ''}` : null,
		preview.existing.length ? ui.dim(`${preview.existing.length} already set up (kept as they are)`) : null,
		preview.stale.length ? `${ui.warn(`−${preview.stale.length}`)} no longer available: ${preview.stale.join(', ')}` : null
	].filter(Boolean).join('\n')
	if (!opts.json)
		p.log.message(summary)

	let prune = !!opts.prune
	let include
	if (interactive && !opts.yes) {
		if (preview.added.length) {
			const all = preview.addedEntries.map(e => transforms.ssoEntryKey(e.accountId, e.roleName))
			const picked = await ask(p.autocompleteMultiselect({
				message: `Add which profiles? ${ui.dim('(all selected: space to untick, type to search, enter to confirm)')}`,
				maxItems: 12,
				initialValues: all,
				options: preview.addedEntries.map((e, i) => ({ value:all[i], label:e.name, hint:[e.accountName, e.accountId, e.roleName].filter(Boolean).join(' · ') }))
			}))
			if (!picked.length && !preview.stale.length)
				return p.outro(ui.dim('Nothing changed.'))
			if (picked.length < all.length)
				include = picked
		}
		if (preview.stale.length)
			prune = await ask(p.confirm({ message:`Remove the ${preview.stale.length} profile${preview.stale.length == 1 ? '' : 's'} that no longer exist${preview.stale.length == 1 ? 's' : ''}?`, initialValue:false }))
	}
	if (include && !include.length && !prune)
		return p.outro(ui.dim('Nothing changed.'))
	if (prune)
		await aws.backupAwsFiles()
	const result = transforms.populateSsoProfiles(configStr, { ssoSession:sessionName, entries, region, prefix, prune, include, version:settings.CLI_VERSION })
	await aws.writeAwsFile(aws.AWS_CONFIG_FILE, result.config)
	await settings.update({})

	if (opts.json) {
		process.stdout.write(JSON.stringify({ added:result.added, existing:result.existing, removed:result.removed, stale:prune ? [] : result.stale }) + '\n')
		return
	}
	p.outro(`${ui.ok(ui.sym.ok)} Added ${result.added.length} profile${result.added.length == 1 ? '' : 's'}${result.removed.length ? `, removed ${result.removed.length}` : ''} ${ui.unicode ? '🎉' : ''}\n   ${ui.dim(`Try: ${shell.FUNCTION_NAME} ${prefix || sessionName}`)}`)
}

/**
 * 'switch-profile remove [profiles...] [--yes]'
 */
const remove = async (names, opts) => {
	const interactive = await begin(opts)
	const state = await loadState()
	names = (names || []).filter(Boolean)
	if (!names.length) {
		if (!interactive)
			throw new ui.CliError('Which profiles?', { code:3, hint:'Run: switch-profile remove <profile...> --yes' })
		names = await ask(p.autocompleteMultiselect({
			message: `Remove which profiles? ${ui.dim('(space to select, enter to confirm)')}`,
			maxItems: 12,
			options: state.profiles.map(x => ({ value:x.name, label:x.name, hint: x.name == state.defaultName ? 'current default: switch first' : describe(x), disabled: x.name == state.defaultName }))
		}))
		if (!names.length)
			return p.outro(ui.dim('Nothing removed.'))
	}
	names.forEach(n => findProfile(state, n))
	if (names.includes(state.defaultName))
		throw new ui.CliError(`${state.defaultName} is the current default profile.`, { code:3, hint:'Switch to another profile first.' })
	if (!opts.yes) {
		if (!interactive)
			throw new ui.CliError('Removing profiles needs confirmation.', { code:3, hint:'Add --yes.' })
		if (!await ask(p.confirm({ message:`Remove ${names.length == 1 ? names[0] : `${names.length} profiles`}?`, initialValue:false })))
			return p.outro(ui.dim('Nothing removed.'))
	}
	const [errors] = await aws.deleteProfiles(names)
	if (errors)
		throw new ui.CliError(ui.errorsMessage(errors))
	p.outro(`${ui.ok(ui.sym.ok)} Removed ${names.join(', ')}`)
}

const LOGIN_MODE_LABELS = {
	auto: 'Auto: device code over SSH, browser otherwise',
	device: 'Always device code (approve from any device)',
	browser: 'Always the browser on this machine'
}

const shortcutLabel = s => {
	if (!s.supported)
		return process.platform == 'win32' ? 'not available in this shell (use PowerShell)' : 'not available for this shell (zsh, bash, fish)'
	if (!s.installed)
		return 'off'
	const files = s.shell.files.map(shell.tilde).join(', ')
	return s.active ? `on ${ui.dim(`(${files})`)}` : `on ${ui.dim(`(${files}), not loaded here: run ${s.shell.reload}`)}`
}

/**
 * 'switch-profile settings'
 */
const settingsCommand = async (args, opts) => {
	await begin(opts, { needsInput:true })
	for (;;) {
		const current = await settings.read()
		const s = await shell.getStatus(settings.CLI_VERSION)
		const legacy = await migrate.findLegacySsoProfiles()
		const mode = settings.getLoginMode(current)
		const here = resolveLoginMode(mode, { env:process.env, platform:process.platform }) == 'device' ? 'device code' : 'browser'
		p.log.message([
			`${ui.dim('Per-terminal switching')}  ${shortcutLabel(s)}`,
			`${ui.dim('SSO login')}               ${LOGIN_MODE_LABELS[mode]}${mode == 'auto' ? ui.dim(` (here: ${here})`) : ''}`,
			`${ui.dim('Legacy SSO profiles')}     ${legacy.length ? ui.warn(`${legacy.length} without auto-refresh`) : 'none'}`,
			ui.dim(`${shell.tilde(settings.SETTINGS_FILE)} · format v${current.formatVersion || settings.FORMAT_VERSION} · written by ${current.lastWrittenBy || settings.CLI_VERSION}`)
		].join('\n'))

		const action = await ask(p.select({
			message: 'Change something?',
			options: [
				...(s.supported ? [s.installed ? { value:'disable', label:'Turn off per-terminal switching' } : { value:'enable', label:'Turn on per-terminal switching', hint:`adds ${shell.FUNCTION_NAME} + tab-completion` }] : []),
				{ value:'login', label:'Change how SSO logins happen' },
				...(legacy.length ? [{ value:'upgrade', label:`Upgrade ${legacy.length} legacy SSO profile${legacy.length > 1 ? 's' : ''}` }] : []),
				{ value:'done', label:'Done' }
			]
		}))
		if (action == 'done')
			return p.outro(ui.dim('Settings saved.'))
		if (action == 'enable') {
			await settings.update({ perTerminalPrompted:true })
			await enableShortcut()
		} else if (action == 'disable') {
			const removed = await shell.uninstall()
			await settings.update({ perTerminalPrompted:true })
			p.log.success(`Removed ${shell.FUNCTION_NAME} from ${removed.files.map(shell.tilde).join(', ')} ${ui.dim('(open terminals keep it until closed)')}`)
		} else if (action == 'login') {
			const loginMode = await ask(p.select({ message:'How should SSO logins happen?', initialValue:mode, options: settings.LOGIN_MODES.map(m => ({ value:m, label:LOGIN_MODE_LABELS[m] })) }))
			await settings.update({ loginMode })
		} else if (action == 'upgrade') {
			await upgradeLegacySso(legacy)
			await settings.update({ ssoUpgradeDeclined:false })
		}
	}
}

module.exports = {
	switch: switchCommand,
	use,
	status,
	login,
	logout,
	add,
	remove,
	settings: settingsCommand
}

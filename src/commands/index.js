/**
 * Every command except the default switch flow (see ./switch.js).
 */
const p = require('@clack/prompts')
const log = require('../log')
const aws = require('../aws')
const transforms = require('../aws/transforms')
const settings = require('../settings')
const shell = require('../shell')
const migrate = require('../migrate')
const rank = require('../rank')
const ini = require('../ini')
const { resolveLoginMode, isRemoteSession, configureSsoFailure } = require('../aws/login')
const ui = require('../ui')
const { ask, preflight, loadState, loginKey, describe, loginState, upgradeLegacySso, chooseRegion } = require('./common')
const { ssoLogin, rememberLogin } = require('./login-flow')
const portals = require('./portals')
const { switchCommand, switchTo, connect, enableShortcut, exportHint } = require('./switch')

const intro = opts => {
	if (!opts.fromPicker && !opts.json)
		p.intro(`${ui.badge('switch-profile')} ${ui.dim(settings.CLI_VERSION)}`)
}

const begin = async (opts, { needsInput, hint } = {}) => {
	const interactive = ui.isInteractive(opts)
	if (needsInput && !interactive)
		throw new ui.CliError('This command is interactive.', { code:3, hint:hint || 'Run it in a terminal, without --json.' })
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
	if (interactive)
		intro(opts)
	return switchTo(findProfile(state, name), state, { ...opts, interactive })
}

/**
 * What 'status --json' says about each profile's login, from the SSO token cache (one read per portal).
 *
 * @return {Function} profile => true | false, or null when the token cache cannot tell (keys, process, console
 *                    sign-in, and role profiles whose source is not SSO)
 */
const profileLoginNeeds = async profiles => {
	const byUrl = new Map()
	for (const x of profiles)
		if (x.kind == 'sso' && !byUrl.has(x.sso_start_url))
			byUrl.set(x.sso_start_url, (await loginState(x)).needsLogin)
	return x => {
		const source = x.kind == 'role' ? profiles.find(y => y.name == x.source_profile) : x
		return source && source.kind == 'sso' ? byUrl.get(source.sso_start_url) : null
	}
}

/**
 * 'switch-profile status [--json]'
 */
const status = async (args, opts) => {
	await begin(opts)
	const state = await loadState()
	const terminal = process.env.AWS_PROFILE || null
	const shortcut = await shell.getStatus(settings.CLI_VERSION).catch(log.tolerated('reading the sp shortcut status', null))
	const d = state.defaultProfile
	const login = d ? await loginState(d, state) : { text:null, needsLogin:false }

	if (opts.json) {
		const at = d ? (state.settings.logins || {})[loginKey(d)] : null
		const needsLogin = await profileLoginNeeds(state.profiles)
		process.stdout.write(JSON.stringify({
			default: d ? { name:d.name, kind:d.kind, account:d.sso_account_id, role:d.sso_role_name, region:d.region, sso_session:d.sso_session, prod:rank.isProd(d), needsLogin:login.needsLogin || needsLogin(d) === true, loggedInAt:at || null } : null,
			terminal,
			shortcut: shortcut ? { installed:shortcut.installed, active:shortcut.active, shell:shortcut.shell.name } : null,
			profiles: state.profiles.map(x => ({ name:x.name, kind:x.kind, account:x.sso_account_id, accountName:x.accountName, role:x.sso_role_name, region:x.region, sso_session:x.sso_session, source_profile:x.source_profile, prod:rank.isProd(x), legacySso:!!x.isLegacySso, generated:!!x.generated, needsLogin:needsLogin(x) }))
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
	if (opts.ssoSession) {
		if (name)
			throw new ui.CliError('Pass a profile or --sso-session, not both.', { code:3 })
		const session = (await portals.findPortal(state, opts.ssoSession)).name
		await ssoLogin({ ssoSession:session }, { label:session, loginKey:session, interactive, loginMode:opts.device ? 'device' : opts.browser ? 'browser' : undefined })
		if (opts.json)
			return void process.stdout.write(JSON.stringify({ session }) + '\n')
		return p.outro(`${ui.ok(ui.sym.ok)} Logged in to ${ui.strong(session)}`)
	}
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
		await connect(profile, state, { interactive, quiet:opts.json, force:true, loginMode })
		await rememberLogin(loginKey(profile))
	}
	const identity = await connect(profile, state, { interactive, quiet:opts.json, loggedIn:true })
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
	if (opts.json)
		return void process.stdout.write(JSON.stringify({ loggedOut:true }) + '\n')
	p.outro(`${ui.ok(ui.sym.ok)} Logged out ${ui.unicode ? '👋' : ''}${isRemoteSession(process.env, process.platform) ? ui.dim(' This machine no longer has AWS access.') : ''}`)
}

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
	if ([opts.fromSso, opts.sso, opts.console].filter(Boolean).length > 1)
		throw new ui.CliError('Pass only one of --from-sso, --sso and --console.', { code:3 })
	const interactive = await begin(opts, {
		needsInput: !opts.fromSso && !opts.sso && !opts.console,
		hint: 'Run it in a terminal without --json, or pass --from-sso <session>, --sso <session> or --console. Access keys can only be added in a terminal.'
	})
	const state = await loadState()
	if (opts.fromSso)
		return importFromSso(state, { ...opts, interactive })
	if (opts.sso)
		return addSsoProfile(state, opts)
	if (opts.console)
		return addConsoleProfile(state, { ...opts, interactive })

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
		const [configErrors, configStr] = await aws.getConfigFile()
		if (configErrors)
			throw ui.cliErrorFrom(configErrors)
		const sessions = transforms.listSsoSessions(configStr)
		p.log.message([
			'Handing over to aws configure sso. You will be asked for:',
			`${ui.dim('1.')} a session name ${ui.dim('(a short name such as acme, not the URL; reuse the same one for every profile of a portal: one login covers them all)')}`,
			`${ui.dim('2.')} the start URL ${ui.dim('(e.g. https://acme.awsapps.com/start)')}`,
			`${ui.dim('3.')} the SSO region ${ui.dim('(where IAM Identity Center lives, not where you deploy)')}`,
			...(sessions.length ? [ui.dim(`Portals already set up: ${sessions.map(x => `${x.name} (${x.sso_region || '?'})`).join(', ')}. Type one of these names to reuse it.`)] : [])
		].join('\n'))
		const [errors, upgraded] = await aws.createSsoProfile(name, { loginMode:settings.getLoginMode(state.settings) })
		if (errors) {
			const failed = errors.find(e => e.output != null)
			if (!failed)
				throw ui.cliErrorFrom(errors)
			const { message, hint } = configureSsoFailure(failed.output, sessions)
			throw new ui.CliError(message, { hint, errors })
		}
		if (upgraded)
			p.log.info(`No session name was given, so ${name} now uses an [sso-session] for auto-refresh. You'll log in once more.`)
	} else if (kind == 'login') {
		const region = await chooseRegion('Default region', 'us-east-1')
		await writeConsoleProfile(name, region)
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
			throw ui.cliErrorFrom(errors)
	}

	p.log.success(`Profile ${ui.accent(name)} created`)
	const next = await loadState()
	if (await ask(p.confirm({ message:`Switch to ${name} now?` })))
		return switchTo(findProfile(next, name), next, { ...opts, interactive })
	p.outro(`Switch to it any time with ${ui.accent(`${shell.FUNCTION_NAME} ${name}`)}`)
}

const writeConsoleProfile = async (name, region) => {
	const [configErrors, configStr] = await aws.getConfigFile()
	if (configErrors)
		throw ui.cliErrorFrom(configErrors)
	await aws.writeAwsFile(aws.AWS_CONFIG_FILE, ini.setSection(configStr, `profile ${name}`, [['region', region], [transforms.VERSION_KEY, settings.CLI_VERSION]]))
	return configStr
}

// Validates the flags that create one profile without prompting. Fails with exit code 3.
const checkNewProfile = (state, opts, flags, usage) => {
	const missing = Object.entries(flags).filter(([, value]) => !value).map(([flag]) => flag)
	if (missing.length)
		throw new ui.CliError(`Missing ${missing.join(', ')}.`, { code:3, hint:`Run: ${usage}` })
	const invalid = validateProfileName([...state.profiles.map(x => x.name), 'default'])(opts.name) || portals.validateRegion(opts.region)
	if (invalid)
		throw new ui.CliError(invalid, { code:3 })
}

/**
 * 'switch-profile add --sso <session> --name <name> --account <id> --role <role> --region <region>': one SSO
 * profile, written without 'aws configure sso'. The role is only checked by AWS at the first login or switch.
 */
const addSsoProfile = async (state, opts) => {
	checkNewProfile(state, opts, { '--name':opts.name, '--account':opts.account, '--role':opts.role, '--region':opts.region }, `switch-profile add --sso ${opts.sso} --name <name> --account <id> --role <role> --region <region>`)
	if (!/^\d{12}$/.test(opts.account))
		throw new ui.CliError('--account must be a 12-digit AWS account id.', { code:3 })
	await portals.findPortal(state, opts.sso)
	const [configErrors, configStr] = await aws.getConfigFile()
	if (configErrors)
		throw ui.cliErrorFrom(configErrors)
	await aws.writeAwsFile(aws.AWS_CONFIG_FILE, transforms.addSsoProfile(configStr, { name:opts.name, ssoSession:opts.sso, accountId:opts.account, roleName:opts.role, region:opts.region, version:settings.CLI_VERSION }))
	await settings.update({})
	if (opts.json)
		return void process.stdout.write(JSON.stringify({ profile:opts.name, session:opts.sso, account:opts.account, role:opts.role, region:opts.region }) + '\n')
	p.log.success(`Profile ${ui.accent(opts.name)} created`)
	p.outro(`Switch to it any time with ${ui.accent(`${shell.FUNCTION_NAME} ${opts.name}`)}`)
}

/**
 * 'switch-profile add --console --name <name> --region <region>': one console sign-in profile. 'aws login' is
 * what makes it a console sign-in profile, so a failed sign-in removes the section again.
 */
const addConsoleProfile = async (state, opts) => {
	checkNewProfile(state, opts, { '--name':opts.name, '--region':opts.region }, 'switch-profile add --console --name <name> --region <region>')
	if (!opts.interactive && isRemoteSession(process.env, process.platform))
		throw new ui.CliError('Without a browser on this machine, aws login needs a code pasted into a terminal.', { code:3, hint:'Run in a terminal, without --json: switch-profile add' })
	const previous = await writeConsoleProfile(opts.name, opts.region)
	try {
		await aws.awsLogin(opts.name, { toStderr:!opts.interactive })
	} catch(err) {
		await aws.writeAwsFile(aws.AWS_CONFIG_FILE, previous)
		throw new ui.CliError(`Could not sign in to ${opts.name}: ${err.message}`, { cause:err })
	}
	await rememberLogin(opts.name)
	if (opts.json)
		return void process.stdout.write(JSON.stringify({ profile:opts.name, region:opts.region }) + '\n')
	p.log.success(`Profile ${ui.accent(opts.name)} created`)
	p.outro(`Switch to it any time with ${ui.accent(`${shell.FUNCTION_NAME} ${opts.name}`)}`)
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
		throw ui.cliErrorFrom(configErrors)
	const sessions = transforms.listSsoSessions(configStr)

	let sessionName = opts.fromSso && opts.fromSso !== true ? opts.fromSso : null
	if (sessionName && !sessions.some(s => s.name == sessionName))
		throw new ui.CliError(`There is no [sso-session ${sessionName}] in ~/.aws/config.`, { code:3, hint: sessions.length ? `Known sessions: ${sessions.map(s => s.name).join(', ')}` : 'Add a portal: switch-profile portals <name> --create --start-url <url> --region <region>' })
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
			const startUrl = (await ask(p.text({ message:'SSO start URL', placeholder:'https://acme.awsapps.com/start', validate:portals.validateStartUrl }))).trim()
			const detected = await aws.detectSsoRegion(startUrl)
			const region = await chooseRegion(`SSO region ${ui.dim(detected ? `(where IAM Identity Center lives: ${detected}, read from the portal)` : '(where IAM Identity Center lives)')}`, detected || 'us-east-1')
			const suggested = transforms.sessionNameFromUrl(startUrl).replace(/[^a-zA-Z0-9_-]/g, '-')
			sessionName = await ask(p.text({ message:`Short name for this portal ${ui.dim('(usually the client)')}`, initialValue:suggested, validate: v => portals.validatePortalName(v) || (sessions.some(s => s.name == v) ? `${v} already exists.` : undefined) }))
			configStr = transforms.addSsoSession(configStr, { name:sessionName, startUrl, region, version:settings.CLI_VERSION })
			await aws.writeAwsFile(aws.AWS_CONFIG_FILE, configStr)
		} else
			sessionName = choice
	}
	let session = transforms.listSsoSessions(configStr).find(s => s.name == sessionName)

	let token = await aws.readSsoToken({ ssoSession:sessionName })
	if (!token) {
		if (!interactive)
			throw new ui.CliError(`Not logged in to ${sessionName}.`, { code:2, hint:`Run: switch-profile login --sso-session ${sessionName}` })
		for (;;) {
			try {
				await ssoLogin({ ssoSession:sessionName }, { label:sessionName, loginKey:sessionName, interactive })
				break
			} catch(err) {
				if (!err.wrongRegion)
					throw err
				const region = await portals.fixSsoRegion(session, err)
				configStr = (await aws.getConfigFile())[1] || configStr
				session = { ...session, sso_region:region }
			}
		}
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
		throw new ui.CliError(`Could not list the accounts of ${sessionName}.`, { hint:String(err.message).trim().split('\n').slice(-1)[0], cause:err })
	}

	const invalidRegion = opts.region && portals.validateRegion(opts.region)
	if (invalidRegion)
		throw new ui.CliError(invalidRegion, { code:3 })
	const sessionRegions = state.profiles.filter(x => x.sso_session == sessionName && x.region).map(x => x.region)
	const region = opts.region || (interactive ? await chooseRegion('Default region for these profiles', sessionRegions[0] || session.sso_region) : session.sso_region)
	const prefix = opts.prefix || (interactive ? await ask(p.text({ message:`Name prefix ${ui.dim('(profiles become <prefix>-<account>-<role>)')}`, initialValue:sessionName, validate: v => /^[a-z0-9_-]*$/.test(v || '') ? undefined : 'Lowercase letters, numbers, - and _ only.' })) : sessionName)

	const preview = transforms.populateSsoProfiles(configStr, { ssoSession:sessionName, entries, region, prefix, prune:false, defaultProfile:state.defaultName, version:settings.CLI_VERSION })
	const removable = preview.stale.filter(name => !preview.kept.some(k => k.name == name))

	const only = opts.only !== undefined ? opts.only.split(',').map(x => x.trim()).filter(Boolean) : null
	if (only && !only.length)
		throw new ui.CliError('--only needs at least one profile name.', { code:3, hint:`See the names with: switch-profile add --from-sso ${sessionName} --dry-run --json` })
	const unknown = (only || []).filter(name => !preview.added.includes(name))
	if (unknown.length)
		throw new ui.CliError(`Not a new profile of ${sessionName}: ${unknown.join(', ')}`, { code:3, hint:`See the names with: switch-profile add --from-sso ${sessionName} --dry-run --json` })
	const selected = only ? preview.addedEntries.filter(e => only.includes(e.name)) : preview.addedEntries

	const summary = [
		preview.added.length ? `${ui.ok(`+${preview.added.length}`)} new: ${preview.added.slice(0, 6).join(', ')}${preview.added.length > 6 ? ', …' : ''}` : null,
		preview.existing.length ? ui.dim(`${preview.existing.length} already set up (kept as they are)`) : null,
		preview.stale.length ? `${ui.warn(`−${preview.stale.length}`)} no longer available: ${preview.stale.join(', ')}` : null,
		...preview.kept.map(k => ui.dim(`${k.name} stays, even with prune: ${k.reason}`))
	].filter(Boolean).join('\n')

	if (opts.dryRun) {
		if (opts.json)
			return void process.stdout.write(JSON.stringify({ dryRun:true, session:sessionName, region, prefix, added:selected.map(e => e.name), addedEntries:selected, existing:preview.existing, removed:opts.prune ? removable : [], stale:preview.stale, kept:preview.kept }) + '\n')
		if (summary)
			p.log.message(summary)
		return p.outro(ui.dim('Dry run: nothing was written.'))
	}

	if (!preview.added.length && !preview.stale.length) {
		if (opts.json)
			return process.stdout.write(JSON.stringify({ added:[], existing:preview.existing, removed:[], stale:[], kept:[] }) + '\n')
		return p.outro(`${ui.ok(ui.sym.ok)} Everything is already set up ${ui.dim(`(${preview.existing.length} profiles)`)}`)
	}

	if (!opts.json)
		p.log.message(summary)

	let prune = !!opts.prune
	let include = only ? selected.map(e => transforms.ssoEntryKey(e.accountId, e.roleName)) : undefined
	if (interactive && !opts.yes) {
		if (preview.added.length && !only) {
			const all = preview.addedEntries.map(e => transforms.ssoEntryKey(e.accountId, e.roleName))
			const picked = await ask(p.autocompleteMultiselect({
				message: `Add which profiles? ${ui.dim('(all selected: space to untick, type to search, enter to confirm)')}`,
				maxItems: 12,
				initialValues: all,
				options: preview.addedEntries.map((e, i) => ({ value:all[i], label:e.name, hint:[e.accountName, e.accountId, e.roleName].filter(Boolean).join(' · ') }))
			}))
			if (!picked.length && !removable.length)
				return p.outro(ui.dim('Nothing changed.'))
			if (picked.length < all.length)
				include = picked
		}
		if (removable.length)
			prune = await ask(p.confirm({ message:`Remove the ${removable.length} profile${removable.length == 1 ? '' : 's'} that no longer exist${removable.length == 1 ? 's' : ''}?`, initialValue:false }))
	}
	if (include && !include.length && !prune)
		return p.outro(ui.dim('Nothing changed.'))
	if (prune)
		await aws.backupAwsFiles()
	const result = transforms.populateSsoProfiles(configStr, { ssoSession:sessionName, entries, region, prefix, prune, include, defaultProfile:state.defaultName, version:settings.CLI_VERSION })
	await aws.writeAwsFile(aws.AWS_CONFIG_FILE, result.config)
	await settings.update({})

	if (opts.json) {
		process.stdout.write(JSON.stringify({ added:result.added, existing:result.existing, removed:result.removed, stale:prune ? result.kept.map(k => k.name) : result.stale, kept:result.kept }) + '\n')
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
	const dependent = state.profiles.find(x => names.includes(x.source_profile) && !names.includes(x.name))
	if (dependent)
		throw new ui.CliError(`${dependent.name} uses ${dependent.source_profile} as its source_profile, and would stop working.`, { code:3, hint:`Remove ${dependent.name} too, or change its source_profile first.` })
	if (!opts.yes) {
		if (!interactive)
			throw new ui.CliError('Removing profiles needs confirmation.', { code:3, hint:'Add --yes.' })
		if (!await ask(p.confirm({ message:`Remove ${names.length == 1 ? names[0] : `${names.length} profiles`}?`, initialValue:false })))
			return p.outro(ui.dim('Nothing removed.'))
	}
	const [errors] = await aws.deleteProfiles(names)
	if (errors)
		throw ui.cliErrorFrom(errors)
	if (opts.json)
		return void process.stdout.write(JSON.stringify({ removed:names }) + '\n')
	p.outro(`${ui.ok(ui.sym.ok)} Removed ${names.join(', ')}`)
}

// Moves obj[from] to obj[to], if present.
const moveKey = (obj, from, to) => {
	if (!obj || !(from in obj))
		return obj
	const { [from]:value, ...rest } = obj
	return { ...rest, [to]:value }
}

/**
 * 'switch-profile rename [profile] [new-name]': renames a profile, and every reference to it switch-profile
 * knows about (source_profile, the default profile, usage and login history).
 */
const rename = async (from, to, opts) => {
	const interactive = await begin(opts)
	const state = await loadState()
	if (!from) {
		if (!interactive)
			throw new ui.CliError('Which profile?', { code:3, hint:'Run: switch-profile rename <profile> <new-name>' })
		from = await ask(p.autocomplete({
			message: 'Rename which profile?',
			maxItems: 12,
			options: state.profiles.map(x => ({ value:x.name, label:x.name, hint:describe(x) }))
		}))
	}
	const profile = findProfile(state, from)
	const taken = [...state.profiles.map(x => x.name).filter(n => n != from), 'default']
	const validate = v => v == from ? 'That is already its name.' : validateProfileName(taken)(v)
	if (!to) {
		if (!interactive)
			throw new ui.CliError('What is the new name?', { code:3, hint:`Run: switch-profile rename ${from} <new-name>` })
		to = await ask(p.text({ message:`New name for ${from}`, initialValue:from, validate }))
	}
	const invalid = validate(to)
	if (invalid)
		throw new ui.CliError(invalid, { code:3 })

	const [errors, result] = await aws.renameProfile(from, to)
	if (errors)
		throw ui.cliErrorFrom(errors)
	const current = await settings.read()
	// Only console sign-in and role profiles key their login history by profile name (SSO uses the session).
	await settings.update({
		usage: moveKey(current.usage, from, to),
		...(loginKey(profile) == from ? { logins:moveKey(current.logins, from, to) } : {})
	})
	const inTerminal = process.env.AWS_PROFILE == from
	const terminal = inTerminal ? await shell.exportProfile(to).catch(log.tolerated('handing the profile to sp', false)) : false

	if (opts.json) {
		process.stdout.write(JSON.stringify({ from, to, default:result.wasDefault, sources:result.sources, processes:result.processes, terminal }) + '\n')
		return
	}
	const lines = [
		result.wasDefault ? ui.dim('still the default profile') : null,
		result.sources.length ? ui.dim(`source_profile updated in ${result.sources.join(', ')}`) : null,
		terminal ? ui.dim('this terminal now uses the new name') : null
	].filter(Boolean)
	p.log.success([`Renamed ${ui.accent(from)} to ${ui.accent(to)}`, ...lines].join('\n'))
	if (result.processes.length)
		p.log.warn(`The credential_process of ${result.processes.join(', ')} still uses --profile ${from}. Update ${result.processes.length == 1 ? 'it' : 'them'} in ~/.aws/config.`)
	if (inTerminal && !terminal)
		p.log.warn(`This terminal still uses ${from}. Run:\n   ${ui.accent(exportHint(to))}`)
	p.outro(ui.dim(`Other terminals, scripts and tools that use ${from} (AWS_PROFILE or --profile) need the new name.`))
}

/**
 * 'switch-profile portals [name]': lists the SSO portals and edits one (start URL, SSO region).
 * With --region or --start-url, edits without prompting.
 */
const portalsCommand = async (name, opts) => {
	const interactive = await begin(opts)
	const state = await loadState()

	if (opts.create) {
		const usage = 'switch-profile portals <name> --create --start-url <url> --region <region>'
		if (!name || !opts.startUrl || !opts.region)
			throw new ui.CliError('A new portal needs a name, --start-url and --region.', { code:3, hint:`Run: ${usage}` })
		const invalid = portals.validatePortalName(name) || portals.validateStartUrl(opts.startUrl) || portals.validateRegion(opts.region)
		if (invalid)
			throw new ui.CliError(invalid, { code:3 })
		if ((await portals.listPortals(state)).some(x => x.name == name))
			throw new ui.CliError(`There is already an SSO portal named ${name}.`, { code:3, hint:`Edit it with: switch-profile portals ${name} --region <region>` })
		await portals.createPortal(name, { startUrl:opts.startUrl, region:opts.region })
		const portal = await portals.findPortal(state, name)
		if (opts.json)
			return void process.stdout.write(JSON.stringify(portal) + '\n')
		p.log.success(`Saved ${ui.accent(name)}: ${ui.join([portal.startUrl, portal.region])}`)
		return p.outro(ui.dim(`Log in: switch-profile login --sso-session ${name}`))
	}

	// Reads the region a start URL names, without saving anything, so it can be proposed before --create or an edit.
	if (opts.check && opts.region)
		throw new ui.CliError('--check only reads: it cannot be combined with --region.', { code:3 })
	if (opts.check && opts.startUrl) {
		const invalid = portals.validateStartUrl(opts.startUrl)
		if (invalid)
			throw new ui.CliError(invalid, { code:3 })
		const detectedRegion = await aws.detectSsoRegion(opts.startUrl)
		if (opts.json)
			return void process.stdout.write(JSON.stringify({ startUrl:opts.startUrl, detectedRegion }) + '\n')
		return console.log(`${opts.startUrl}\tportal says ${detectedRegion || '?'}`)
	}

	if (opts.region || opts.startUrl) {
		if (!name)
			throw new ui.CliError('Which portal?', { code:3, hint:'Run: switch-profile portals <name> --region <region>' })
		const invalid = (opts.region && portals.validateRegion(opts.region)) || (opts.startUrl && portals.validateStartUrl(opts.startUrl))
		if (invalid)
			throw new ui.CliError(invalid, { code:3 })
		await portals.findPortal(state, name)
		await portals.updatePortal(name, { region:opts.region, startUrl:opts.startUrl })
		const portal = await portals.findPortal(state, name)
		if (opts.json)
			return void process.stdout.write(JSON.stringify(portal) + '\n')
		p.log.success(`Saved ${ui.accent(name)}: ${ui.join([portal.startUrl, portal.region])}`)
		return p.outro(ui.dim(`Log in again: switch-profile login <a ${name} profile>`))
	}

	if (!interactive) {
		const list = await portals.listPortals(state, { detect:!!opts.check })
		const selected = name ? list.filter(x => x.name == name) : list
		if (name && !selected.length)
			await portals.findPortal(state, name)
		if (opts.json)
			return void process.stdout.write(JSON.stringify({ portals:selected }) + '\n')
		for (const x of selected)
			console.log(`${x.name}\t${x.region || '-'}\t${x.startUrl || '-'}\t${x.profiles.length} profiles${opts.check ? `\tportal says ${x.detectedRegion || '?'}` : ''}`)
		return
	}

	if (!name) {
		const spin = ui.spinner()
		spin.start('Reading the portals')
		const list = await portals.listPortals(state, { detect:true })
		spin.stop(`${list.length} SSO portal${list.length == 1 ? '' : 's'}`)
		if (!list.length)
			return p.outro(ui.dim('No SSO portals yet. Add one with Add › Accounts from an SSO portal.'))
		const picked = await ask(p.select({
			message: 'Which portal?',
			options: list.map(x => ({ value:x.name, label:x.name, hint:portals.portalHint(x) }))
		}))
		const { changed } = await portals.editPortal(picked, state, { detectedRegion:list.find(x => x.name == picked).detectedRegion })
		return p.outro(ui.dim(changed ? 'Saved.' : 'Nothing changed.'))
	}
	await portals.findPortal(state, name)
	const { changed } = await portals.editPortal(name, state)
	p.outro(ui.dim(changed ? 'Saved.' : 'Nothing changed.'))
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

const readSettingsState = async () => {
	const current = await settings.read()
	const mode = settings.getLoginMode(current)
	return {
		current,
		mode,
		here: resolveLoginMode(mode, { env:process.env, platform:process.platform }),
		s: await shell.getStatus(settings.CLI_VERSION),
		legacy: await migrate.findLegacySsoProfiles()
	}
}

const settingsSummary = ({ current, mode, here, s, legacy }) => [
	`${ui.dim('Per-terminal switching')}  ${shortcutLabel(s)}`,
	`${ui.dim('SSO login')}               ${LOGIN_MODE_LABELS[mode]}${mode == 'auto' ? ui.dim(` (here: ${here == 'device' ? 'device code' : 'browser'})`) : ''}`,
	`${ui.dim('Legacy SSO profiles')}     ${legacy.length ? ui.warn(`${legacy.length} without auto-refresh`) : 'none'}`,
	ui.dim(`${shell.tilde(settings.SETTINGS_FILE)} · format v${current.formatVersion || settings.FORMAT_VERSION} · written by ${current.lastWrittenBy || settings.CLI_VERSION}`)
].join('\n')

/**
 * Settings without prompting: applies --login-mode, --shortcut and --upgrade-legacy-sso, then reports the state.
 */
const applySettings = async opts => {
	if (opts.loginMode && !settings.LOGIN_MODES.includes(opts.loginMode))
		throw new ui.CliError(`Unknown login mode ${opts.loginMode}.`, { code:3, hint:`Use one of: ${settings.LOGIN_MODES.join(', ')}` })
	if (opts.shortcut && !['on', 'off'].includes(opts.shortcut))
		throw new ui.CliError(`--shortcut must be on or off, not ${opts.shortcut}.`, { code:3 })
	const before = await readSettingsState()
	if (opts.shortcut == 'on' && !before.s.supported)
		throw new ui.CliError('The sp shortcut is not available for this shell.', { code:3, hint:'Supported shells: zsh, bash, fish and PowerShell.' })

	const changed = {}
	if (opts.loginMode) {
		await settings.update({ loginMode:opts.loginMode })
		changed.loginMode = opts.loginMode
	}
	if (opts.shortcut) {
		const { files } = opts.shortcut == 'on' ? await shell.install(settings.CLI_VERSION) : await shell.uninstall()
		await settings.update({ perTerminalPrompted:true })
		changed.shortcut = { state:opts.shortcut, files }
	}
	if (opts.upgradeLegacySso && before.legacy.length) {
		const { sessions, backups } = await migrate.upgradeLegacySsoProfiles(before.legacy)
		await settings.update({ ssoUpgradeDeclined:false })
		changed.legacySso = { upgraded:before.legacy, sessions, backups }
	}

	const after = await readSettingsState()
	if (opts.json) {
		const { supported, installed, active, outdated, shell:sh } = after.s
		return void process.stdout.write(JSON.stringify({
			loginMode: after.mode,
			loginModeHere: after.here,
			shortcut: { supported, installed, active, outdated, shell:sh.name || null, files:sh.files || [], reload:sh.reload || null },
			legacySso: after.legacy,
			settingsFile: settings.SETTINGS_FILE,
			formatVersion: after.current.formatVersion || settings.FORMAT_VERSION,
			changed
		}, null, 2) + '\n')
	}
	p.log.message(settingsSummary(after))
	if (changed.shortcut)
		p.log.success(opts.shortcut == 'on' ? `Added ${ui.accent(shell.FUNCTION_NAME)} to ${changed.shortcut.files.map(shell.tilde).join(', ')}\n${ui.dim(`Open a new terminal or run: ${after.s.shell.reload}`)}` : `Removed ${shell.FUNCTION_NAME} from ${changed.shortcut.files.map(shell.tilde).join(', ')} ${ui.dim('(open terminals keep it until closed)')}`)
	if (changed.legacySso)
		p.log.success(`Upgraded ${before.legacy.length} legacy SSO profile${before.legacy.length > 1 ? 's' : ''}. Log in once per portal. ${ui.dim(`Backups: ${changed.legacySso.backups.join(', ')}`)}`)
	p.outro(ui.dim(Object.keys(changed).length ? 'Settings saved.' : 'Nothing changed.'))
}

/**
 * 'switch-profile settings': a page in a terminal. With flags, with --json or without a terminal, no prompts.
 */
const settingsCommand = async (args, opts) => {
	const interactive = await begin(opts)
	if (!interactive || opts.loginMode || opts.shortcut || opts.upgradeLegacySso)
		return applySettings(opts)
	for (;;) {
		const { current, mode, s, legacy, here } = await readSettingsState()
		p.log.message(settingsSummary({ current, mode, here, s, legacy }))

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
	rename,
	portals: portalsCommand,
	settings: settingsCommand
}

const { assert } = require('chai')
const fs = require('fs')
const os = require('os')
const { join } = require('path')
const { spawnSync } = require('child_process')

// Runs the real CLI, non-interactively, against a throwaway HOME and a fake AWS CLI (test/fixtures/bin/aws).
const ROOT = join(__dirname, '..')
const BIN = join(__dirname, 'fixtures', 'bin')
const CONFIG = `[sso-session acme]
sso_start_url = https://acme.awsapps.com/start
sso_region = us-east-1
sso_registration_scopes = sso:account:access

[profile acme-prod]
sso_session = acme
sso_account_id = 111111111111
sso_role_name = Admin
region = ap-southeast-2

[profile acme-dev]
sso_session = acme
sso_account_id = 222222222222
sso_role_name = Admin
region = ap-southeast-2

[profile keys]
region = us-west-2
`

;(process.platform == 'win32' ? describe.skip : describe)('cli', function() {
	this.timeout(30000)
	let home
	const run = (args, env) => {
		const r = spawnSync(process.execPath, [join(ROOT, 'index.js'), ...args], {
			env: { PATH:`${BIN}:${process.env.PATH}`, HOME:home, FAKE_LOGIN_DELAY:'100', ...(process.env.SWITCH_PROFILE_DIST ? { SWITCH_PROFILE_DIST:'1' } : {}), ...env },
			encoding: 'utf8'
		})
		return { code:r.status, out:r.stdout, err:r.stderr }
	}
	const config = () => fs.readFileSync(join(home, '.aws', 'config'), 'utf8')

	before(() => {
		home = fs.mkdtempSync(join(os.tmpdir(), 'sp-cli-'))
		fs.mkdirSync(join(home, '.aws'))
		fs.writeFileSync(join(home, '.aws', 'config'), CONFIG)
		fs.writeFileSync(join(home, '.aws', 'credentials'), '[keys]\naws_access_key_id = AKIA\naws_secret_access_key = s\n')
	})
	after(() => fs.rmSync(home, { recursive:true, force:true }))

	it('Should print the version and help', () => {
		assert.match(run(['--version']).out, /^\d+\.\d+\.\d+/)
		assert.include(run(['--help']).out, 'Exit codes')
	})

	it('Should switch to a standard profile and report it as JSON', () => {
		const r = run(['keys', '--json'])
		assert.equal(r.code, 0, r.err)
		assert.deepInclude(JSON.parse(r.out), { profile:'keys', account:'999999999999', default:true, terminal:false })
		assert.include(config(), 'switch_profile_name = keys')
	})

	it('Should exit 2 with a hint when an SSO login is needed', () => {
		const r = run(['acme-dev'])
		assert.equal(r.code, 2)
		assert.include(r.err, 'switch-profile login acme-dev')
	})

	it('Should log in non-interactively, then switch with a fuzzy query', () => {
		const login = run(['login', 'acme-dev', '--device', '--json'])
		assert.equal(login.code, 0, login.err)
		assert.include(login.err, 'WXYZ-ABCD', 'the device code goes to stderr')
		assert.equal(JSON.parse(login.out).account, '222222222222')
		const r = run(['acme', 'dev', '--json'])
		assert.equal(r.code, 0, r.err)
		assert.equal(JSON.parse(r.out).profile, 'acme-dev')
	})

	it('Should hand the profile to the sp shortcut and nothing else', () => {
		const file = join(home, 'env-file')
		const r = run(['use', 'acme-prod'], { SWITCH_PROFILE_SHELL:'zsh', SWITCH_PROFILE_ENV_FILE:file })
		assert.equal(r.code, 0, r.err)
		assert.equal(fs.readFileSync(file, 'utf8'), 'acme-prod')
	})

	it('Should exit 3 on ambiguous or unknown profiles', () => {
		const ambiguous = run(['acme'])
		assert.equal(ambiguous.code, 3)
		assert.include(ambiguous.err, 'acme-prod')
		assert.equal(run(['nope']).code, 3)
		assert.equal(run([]).code, 3)
		const json = run(['nope', '--json'])
		assert.deepInclude(JSON.parse(json.err), { code:3 })
	})

	it('Should describe the state as JSON', () => {
		const s = JSON.parse(run(['status', '--json']).out)
		assert.equal(s.default.name, 'acme-prod')
		assert.isTrue(s.default.prod)
		assert.isFalse(s.default.needsLogin)
		assert.deepEqual(s.profiles.map(p => p.name), ['acme-prod', 'acme-dev', 'keys'])
	})

	it('Should import an SSO portal non-interactively', () => {
		const r = run(['add', '--from-sso', 'acme', '--region', 'eu-west-1', '--yes', '--json'])
		assert.equal(r.code, 0, r.err)
		const out = JSON.parse(r.out)
		assert.deepEqual(out.existing, ['acme-prod', 'acme-dev'])
		assert.deepEqual(out.added, ['acme-prod-workloads-readonly', 'acme-dev-readonly', 'acme-security-readonly'])
		assert.include(config(), 'switch_profile_generated = acme')
	})

	it('Should refuse to remove without --yes, and remove with it', () => {
		assert.equal(run(['remove', 'acme-security-readonly']).code, 3)
		assert.equal(run(['remove', 'acme-security-readonly', '--yes']).code, 0)
		assert.notInclude(config(), 'acme-security-readonly')
		assert.equal(run(['remove', 'acme-prod', '--yes']).code, 3, 'the current default cannot be removed')
	})

	it('Should list and edit SSO portals without prompting', () => {
		const list = JSON.parse(run(['portals', '--json']).out)
		const acme = list.portals.find(x => x.name == 'acme')
		assert.include(acme, { name:'acme', startUrl:'https://acme.awsapps.com/start', region:'us-east-1' })
		assert.includeMembers(acme.profiles, ['acme-prod', 'acme-dev'])
		assert.equal(run(['portals', 'nope', '--json']).code, 3)
		assert.equal(run(['portals', '--region', 'eu-west-1']).code, 3, 'the portal name is required')
		assert.equal(run(['portals', 'acme', '--region', 'mars-1']).code, 3)
		assert.equal(run(['portals', 'acme', '--start-url', 'http://insecure']).code, 3)
		const r = run(['portals', 'acme', '--region', 'eu-west-1', '--json'])
		assert.equal(r.code, 0, r.err)
		assert.include(JSON.parse(r.out), { name:'acme', region:'eu-west-1' })
		assert.match(config(), /\[sso-session acme\]\nsso_start_url = https:\/\/acme.awsapps.com\/start\nsso_region = eu-west-1/)
		assert.equal(run(['portals', 'acme', '--region', 'us-east-1']).code, 0)
	})

	it('Should rename a profile and keep it the default', () => {
		assert.equal(run(['rename', 'acme-prod']).code, 3, 'the new name is required without a terminal')
		assert.equal(run(['rename', 'acme-prod', 'acme-dev']).code, 3, 'name taken')
		assert.equal(run(['rename', 'acme-prod', 'Bad Name']).code, 3)
		const file = join(home, 'rename-env-file')
		const r = run(['rename', 'acme-prod', 'acme-production', '--json'], { AWS_PROFILE:'acme-prod', SWITCH_PROFILE_SHELL:'zsh', SWITCH_PROFILE_ENV_FILE:file })
		assert.equal(r.code, 0, r.err)
		assert.deepInclude(JSON.parse(r.out), { from:'acme-prod', to:'acme-production', default:true, terminal:true })
		assert.equal(fs.readFileSync(file, 'utf8'), 'acme-production', 'this terminal follows the new name')
		assert.include(config(), '[profile acme-production]')
		assert.include(config(), 'switch_profile_name = acme-production')
		const s = JSON.parse(fs.readFileSync(join(home, '.switch-profile', 'settings.json'), 'utf8'))
		assert.property(s.usage, 'acme-production')
		assert.notProperty(s.usage, 'acme-prod')
		assert.equal(run(['mv', 'acme-production', 'acme-prod']).code, 0)
		assert.include(config(), 'switch_profile_name = acme-prod')
	})

	it('Should log out', () => {
		assert.equal(run(['logout']).code, 3)
		assert.deepEqual(JSON.parse(run(['logout', '--yes', '--json']).out), { loggedOut:true })
		assert.equal(run(['acme-dev']).code, 2)
	})

	describe('setting up without a terminal', () => {
		const SSO_URL = 'https://globex.awsapps.com/start'
		it('Should save a new portal, refusing bad input and duplicates', () => {
			assert.equal(run(['portals', 'globex', '--create', '--start-url', SSO_URL]).code, 3, 'the region is required')
			assert.equal(run(['portals', 'bad name', '--create', '--start-url', SSO_URL, '--region', 'us-east-1']).code, 3)
			assert.equal(run(['portals', 'globex', '--create', '--start-url', 'http://insecure', '--region', 'us-east-1']).code, 3)
			assert.equal(run(['portals', 'globex', '--create', '--start-url', SSO_URL, '--region', 'mars-1']).code, 3)
			const r = run(['portals', 'globex', '--create', '--start-url', SSO_URL, '--region', 'us-east-1', '--json'])
			assert.equal(r.code, 0, r.err)
			assert.deepEqual(JSON.parse(r.out), { name:'globex', startUrl:SSO_URL, region:'us-east-1', profiles:[] })
			assert.include(config(), 'sso_registration_scopes = sso:account:access')
			assert.equal(run(['portals', 'globex', '--create', '--start-url', SSO_URL, '--region', 'us-east-1']).code, 3, 'already exists')
		})

		it('Should read the region of a portal that is not saved yet, or return null', () => {
			const r = run(['portals', '--check', '--start-url', 'https://127.0.0.1:9/start', '--json'])
			assert.equal(r.code, 0, r.err)
			assert.deepEqual(JSON.parse(r.out), { startUrl:'https://127.0.0.1:9/start', detectedRegion:null })
			assert.equal(run(['portals', '--check', '--start-url', 'http://insecure', '--json']).code, 3)
		})

		it('Should need a login for the import, then log in to the portal itself', () => {
			const before = run(['add', '--from-sso', 'globex', '--json'])
			assert.equal(before.code, 2)
			assert.include(JSON.parse(before.err).hint, 'login --sso-session globex')
			assert.equal(run(['login', '--sso-session', 'nope', '--json']).code, 3)
			assert.equal(run(['login', 'acme-dev', '--sso-session', 'globex']).code, 3)
			const r = run(['login', '--sso-session', 'globex', '--device', '--json'])
			assert.equal(r.code, 0, r.err)
			assert.include(r.err, 'WXYZ-ABCD')
			assert.deepEqual(JSON.parse(r.out), { session:'globex' })
			const s = JSON.parse(fs.readFileSync(join(home, '.switch-profile', 'settings.json'), 'utf8'))
			assert.isString(s.logins.globex, 'a non-interactive login is remembered')
		})

		it('Should preview an import without writing anything', () => {
			const before = config()
			const r = run(['add', '--from-sso', 'globex', '--prefix', 'gx', '--region', 'eu-west-1', '--dry-run', '--json'])
			assert.equal(r.code, 0, r.err)
			const out = JSON.parse(r.out)
			assert.isTrue(out.dryRun)
			assert.deepEqual(out.added, ['gx-prod-workloads-admin', 'gx-prod-workloads-readonly', 'gx-dev-admin', 'gx-dev-readonly', 'gx-security-readonly'])
			assert.deepInclude(out.addedEntries, { name:'gx-security-readonly', accountId:'333333333333', accountName:'Security', roleName:'ReadOnly' })
			assert.equal(config(), before)
		})

		it('Should import only the chosen profiles', () => {
			const args = ['add', '--from-sso', 'globex', '--prefix', 'gx', '--region', 'eu-west-1', '--json']
			assert.equal(run([...args, '--only', 'gx-nope']).code, 3)
			const r = run([...args, '--only', 'gx-dev-admin,gx-prod-workloads-readonly'])
			assert.equal(r.code, 0, r.err)
			assert.deepEqual(JSON.parse(r.out).added, ['gx-prod-workloads-readonly', 'gx-dev-admin'])
			assert.notInclude(config(), 'gx-security-readonly')
		})

		it('Should create one SSO profile from flags', () => {
			const base = ['add', '--sso', 'globex', '--name', 'gx-one', '--account', '555555555555', '--role', 'Admin', '--region', 'us-west-2']
			assert.equal(run(['add', '--sso', 'globex', '--name', 'gx-one']).code, 3, '--account, --role and --region are required')
			assert.equal(run(['add', '--sso', 'nope', ...base.slice(3)]).code, 3, 'unknown portal')
			assert.equal(run(['add', '--sso', 'globex', '--name', 'gx-one', '--account', '12', '--role', 'Admin', '--region', 'us-west-2']).code, 3)
			assert.equal(run(['add', '--sso', 'globex', '--name', 'Bad Name', '--account', '555555555555', '--role', 'Admin', '--region', 'us-west-2']).code, 3)
			assert.equal(run(['add', '--sso', 'globex', '--name', 'default', '--account', '555555555555', '--role', 'Admin', '--region', 'us-west-2']).code, 3)
			assert.equal(run(['add', '--sso', 'globex', '--console']).code, 3, 'one kind at a time')
			const r = run([...base, '--json'])
			assert.equal(r.code, 0, r.err)
			assert.deepEqual(JSON.parse(r.out), { profile:'gx-one', session:'globex', account:'555555555555', role:'Admin', region:'us-west-2' })
			assert.equal(run(base).code, 3, 'name taken')
			const p = JSON.parse(run(['status', '--json']).out).profiles.find(x => x.name == 'gx-one')
			assert.deepInclude(p, { kind:'sso', account:'555555555555', role:'Admin', sso_session:'globex', generated:false, legacySso:false, needsLogin:false })
			assert.equal(JSON.parse(run(['use', 'gx-one', '--json']).out).account, '555555555555')
			assert.equal(run(['use', 'keys']).code, 0)
		})

		it('Should still refuse the interactive add menu, with a hint', () => {
			const r = run(['add'])
			assert.equal(r.code, 3)
			assert.include(r.err, '--from-sso')
		})

		it('Should create a console sign-in profile, and leave nothing behind when the sign-in fails', () => {
			const args = ['add', '--console', '--name', 'cs-one', '--region', 'us-west-2', '--json']
			assert.equal(run(['add', '--console', '--name', 'cs-one']).code, 3, '--region is required')
			const remote = run(args, { SSH_CONNECTION:'x' })
			assert.equal(remote.code, 3)
			assert.notInclude(config(), 'cs-one', 'over SSH it needs a terminal')
			const failed = run(args, { DISPLAY:':0', FAKE_LOGIN_FAIL:'1' })
			assert.equal(failed.code, 1)
			assert.notInclude(config(), 'cs-one')
			const r = run(args, { DISPLAY:':0' })
			assert.equal(r.code, 0, r.err)
			assert.deepEqual(JSON.parse(r.out), { profile:'cs-one', region:'us-west-2' }, 'stdout stays JSON')
			const p = JSON.parse(run(['status', '--json']).out).profiles.find(x => x.name == 'cs-one')
			assert.deepInclude(p, { kind:'login', needsLogin:null })
		})

		it('Should not wait for a pasted code when a console sign-in needs a terminal', () => {
			const r = run(['login', 'cs-one', '--json'], { SSH_CONNECTION:'x' })
			assert.equal(r.code, 2)
			assert.include(JSON.parse(r.err).hint, 'login cs-one')
		})

		it('Should report JSON when removing profiles', () => {
			const r = run(['remove', 'cs-one', 'gx-one', '--yes', '--json'])
			assert.equal(r.code, 0, r.err)
			assert.deepEqual(JSON.parse(r.out), { removed:['cs-one', 'gx-one'] })
		})
	})

	describe('edge cases without a terminal', () => {
		const args = ['add', '--from-sso', 'globex', '--prefix', 'gx', '--json']

		it('Should accept any region that looks like one, and refuse the rest', () => {
			assert.equal(run(['portals', 'melb', '--create', '--start-url', 'https://melb.awsapps.com/start', '--region', 'ap-southeast-4']).code, 0)
			assert.equal(run(['portals', 'gov', '--create', '--start-url', 'https://gov.awsapps.com/start', '--region', 'us-gov-west-1']).code, 0)
			assert.equal(run([...args, '--region', 'not-a-region', '--dry-run']).code, 3)
		})

		it('Should refuse an empty --only instead of adding everything', () => {
			const before = config()
			assert.equal(run([...args, '--region', 'eu-west-1', '--only', '']).code, 3)
			assert.equal(run([...args, '--region', 'eu-west-1', '--only', ',']).code, 3)
			assert.equal(config(), before)
		})

		it('Should never write with --check', () => {
			const before = config()
			const r = run(['portals', 'globex', '--check', '--start-url', 'https://127.0.0.1:9/other', '--json'])
			assert.equal(r.code, 0, r.err)
			assert.deepEqual(JSON.parse(r.out), { startUrl:'https://127.0.0.1:9/other', detectedRegion:null })
			assert.equal(run(['portals', 'globex', '--check', '--region', 'eu-west-1']).code, 3)
			assert.equal(config(), before)
		})

		it('Should keep the access keys of a name when a console sign-in fails', () => {
			const creds = join(home, '.aws', 'credentials')
			fs.appendFileSync(creds, '\n[only-creds]\naws_access_key_id = AKIA2\naws_secret_access_key = s2\n')
			assert.equal(run(['add', '--console', '--name', 'only-creds', '--region', 'us-east-1'], { DISPLAY:':0', FAKE_LOGIN_FAIL:'1' }).code, 1)
			assert.include(fs.readFileSync(creds, 'utf8'), 'AKIA2')
			assert.notInclude(config(), 'only-creds')
		})

		it('Should remove exactly the named profile, whatever characters its name has', () => {
			fs.appendFileSync(join(home, '.aws', 'config'), '\n[profile myxprod]\nregion = us-east-1\n\n[profile my.prod]\nregion = us-east-1\n')
			assert.equal(run(['remove', 'my.prod', '--yes']).code, 0)
			assert.include(config(), '[profile myxprod]')
			assert.notInclude(config(), '[profile my.prod]')
			assert.equal(run(['remove', 'myxprod', '--yes']).code, 0)
		})

		it('Should say so when a login worked but the role has no access, instead of asking for a login again', () => {
			const r = run(['login', 'gx-dev-admin', '--device', '--json'], { FAKE_NO_ACCESS:'1' })
			assert.equal(r.code, 1, r.err)
			assert.include(JSON.parse(r.err.trim().split('\n').pop()).error, 'still has no access', 'the last line of stderr, after the login output')
		})

		it('Should honor --device for a role profile, and refuse a role with nothing to log in to', () => {
			fs.appendFileSync(join(home, '.aws', 'config'), '\n[profile role-sso]\nrole_arn = arn:aws:iam::777777777777:role/R\nsource_profile = gx-dev-admin\n\n[profile role-keys]\nrole_arn = arn:aws:iam::777777777777:role/R\nsource_profile = keys\n')
			const r = run(['login', 'role-sso', '--device', '--json'], { DISPLAY:':0' })
			assert.equal(r.code, 0, r.err)
			assert.include(r.err, 'WXYZ-ABCD')
			assert.equal(run(['login', 'role-keys', '--json']).code, 3)
			assert.equal(JSON.parse(run(['status', '--json']).out).profiles.find(x => x.name == 'role-sso').needsLogin, false)
			assert.equal(run(['remove', 'role-sso', 'role-keys', '--yes']).code, 0)
		})

		it('Should not offer the sp shortcut without a terminal', () => {
			const before = fs.readFileSync(join(home, '.switch-profile', 'settings.json'), 'utf8')
			assert.notInclude(before, 'perTerminalPrompted')
			const r = run(['use', 'keys', '--no-input'], { SHELL:'/bin/bash' })
			assert.equal(r.code, 0, r.err)
			assert.notInclude(r.out, 'Set up the sp shortcut')
			assert.notInclude(fs.readFileSync(join(home, '.switch-profile', 'settings.json'), 'utf8'), 'perTerminalPrompted')
		})
	})

	describe('settings without a terminal', () => {
		const state = args => JSON.parse(run(['settings', ...args, '--json'], { SHELL:'/bin/bash' }).out)

		it('Should report the settings', () => {
			const s = state([])
			assert.include(s, { loginMode:'auto', loginModeHere:'device', formatVersion:2 })
			assert.deepInclude(s.shortcut, { supported:true, installed:false, shell:'bash' })
			assert.deepEqual(s.changed, {})
			assert.equal(run(['settings']).code, 0)
		})

		it('Should change the login mode', () => {
			assert.equal(run(['settings', '--login-mode', 'nope']).code, 3)
			assert.deepInclude(state(['--login-mode', 'browser']), { loginMode:'browser', loginModeHere:'browser' })
			assert.equal(state(['--login-mode', 'auto']).loginMode, 'auto')
		})

		it('Should turn the sp shortcut on and off', () => {
			assert.equal(run(['settings', '--shortcut', 'maybe']).code, 3)
			assert.equal(run(['settings', '--shortcut', 'on'], { SHELL:'/bin/nope' }).code, 3, 'unsupported shell')
			const rc = join(home, process.platform == 'darwin' ? '.bash_profile' : '.bashrc')
			assert.isTrue(state(['--shortcut', 'on']).shortcut.installed)
			assert.include(fs.readFileSync(rc, 'utf8'), '# >>> switch-profile')
			assert.isFalse(state(['--shortcut', 'off']).shortcut.installed)
			assert.notInclude(fs.readFileSync(rc, 'utf8'), '# >>> switch-profile')
		})

		it('Should upgrade legacy SSO profiles, with backups', () => {
			fs.appendFileSync(join(home, '.aws', 'config'), '\n[profile old-sso]\nsso_start_url = https://initech.awsapps.com/start\nsso_region = us-east-1\nsso_account_id = 666666666666\nsso_role_name = Admin\n')
			assert.deepEqual(state([]).legacySso, ['old-sso'])
			const s = state(['--upgrade-legacy-sso'])
			assert.deepEqual(s.legacySso, [])
			assert.deepEqual(s.changed.legacySso.upgraded, ['old-sso'])
			assert.isAbove(s.changed.legacySso.backups.length, 0)
			assert.include(config(), '[sso-session initech]')
			assert.equal(run(['remove', 'old-sso', '--yes']).code, 0)
		})
	})

	it('Should log every run, AWS CLI call and error to ~/.switch-profile/switch-profile.log', () => {
		const r = run(['use', 'no-such-profile'])
		assert.equal(r.code, 3)
		const text = fs.readFileSync(join(home, '.switch-profile', 'switch-profile.log'), 'utf8')
		assert.match(text, /INFO {2}run switch-profile \d+\.\d+\.\d+ use no-such-profile/)
		assert.match(text, /exec aws --version → ok in \d+ms|exec which aws/)
		assert.match(text, /ERROR use failed\n {2}CliError: .*no-such-profile/)
		assert.include(text, 'exit 3')
		// Earlier tests in this HOME: the non-interactive login, and the tolerated 'aws logout --all' failure.
		assert.match(text, /exec aws sso login --profile acme-dev --use-device-code --no-browser → ok in \d+ms/)
		assert.include(text, 'WARN  aws logout --all failed (ignored)')
	})
})

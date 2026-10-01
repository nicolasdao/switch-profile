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
			env: { PATH:`${BIN}:${process.env.PATH}`, HOME:home, FAKE_LOGIN_DELAY:'100', ...env },
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

	it('Should log out', () => {
		assert.equal(run(['logout']).code, 3)
		assert.equal(run(['logout', '--yes']).code, 0)
		assert.equal(run(['acme-dev']).code, 2)
	})
})

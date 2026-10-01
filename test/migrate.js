const { assert } = require('chai')
const fs = require('fs')
const os = require('os')
const { join } = require('path')

// Runs the real migration code against a throwaway HOME.
describe('migrate', () => {
	let home, migrate, ini, realHome
	const SRC = join(__dirname, '..', 'src')

	before(() => {
		realHome = process.env.HOME
		home = fs.mkdtempSync(join(os.tmpdir(), 'sp-home-'))
		process.env.HOME = home
		Object.keys(require.cache).filter(k => k.startsWith(SRC)).forEach(k => delete require.cache[k])
		migrate = require('../src/migrate')
		ini = require('../src/ini')
		fs.mkdirSync(join(home, '.aws'))
		fs.writeFileSync(join(home, '.aws', 'config'), '[default]\nregion = us-east-1\n\n[profile dev]\nsso_start_url = https://acme.awsapps.com/start\nsso_region = us-east-1\nsso_account_id = 1\nsso_role_name = Admin\nregion = ap-southeast-2\n')
		fs.writeFileSync(join(home, '.aws', 'credentials'), '[default]\naws_access_key_id = ASIATEMP\naws_secret_access_key = s\naws_session_token = t\nexpiry_date = 2021-07-17T11:33:12.000Z\nprofile = dev\n')
	})

	after(() => {
		process.env.HOME = realHome
		Object.keys(require.cache).filter(k => k.startsWith(SRC)).forEach(k => delete require.cache[k])
		fs.rmSync(home, { recursive:true, force:true })
	})

	const read = f => fs.readFileSync(join(home, '.aws', f), 'utf8')

	it('Should migrate a 1.x install with backups', async () => {
		const result = await migrate.runMigrations()
		assert.isTrue(result.migrated)
		assert.equal(result.defaultProfile, 'dev')
		assert.equal(result.backups.length, 2)
		result.backups.forEach(b => assert.isTrue(fs.existsSync(b)))
		assert.notInclude(read('credentials'), 'ASIATEMP')
		assert.equal(ini.getSection(read('config'), 'default').switch_profile_name, 'dev')
		const settings = JSON.parse(fs.readFileSync(join(home, '.switch-profile', 'settings.json'), 'utf8'))
		assert.equal(settings.formatVersion, 2)
		assert.equal(settings.migratedFrom, 1)
		assert.isString(settings.lastWrittenBy)
	})

	it('Should do nothing the second time', async () => {
		const result = await migrate.runMigrations()
		assert.isFalse(result.migrated)
	})

	it('Should heal a [default] rewritten by switch-profile 1.x after upgrading', async () => {
		fs.writeFileSync(join(home, '.aws', 'credentials'), '[default]\naws_access_key_id = ASIAAGAIN\naws_secret_access_key = s\nexpiry_date = 2021-07-17T11:33:12.000Z\nprofile = dev\n')
		const result = await migrate.runMigrations()
		assert.isTrue(result.migrated)
		assert.notInclude(read('credentials'), 'ASIAAGAIN')
	})

	it('Should upgrade legacy SSO profiles and rewrite [default]', async () => {
		assert.deepEqual(await migrate.findLegacySsoProfiles(), ['dev'])
		const { sessions } = await migrate.upgradeLegacySsoProfiles(['dev'])
		assert.equal(sessions[0].name, 'acme')
		const def = ini.getSection(read('config'), 'default')
		assert.equal(def.sso_session, 'acme')
		assert.notProperty(def, 'sso_start_url')
		assert.deepEqual(await migrate.findLegacySsoProfiles(), [])
	})

	it('Should refuse files written by a newer format', async () => {
		const file = join(home, '.switch-profile', 'settings.json')
		const s = JSON.parse(fs.readFileSync(file, 'utf8'))
		fs.writeFileSync(file, JSON.stringify({ ...s, formatVersion:99, lastWrittenBy:'9.0.0' }))
		try {
			await migrate.runMigrations()
			assert.fail('should have thrown')
		} catch(err) {
			assert.instanceOf(err, migrate.NewerFormatError)
			assert.include(err.message, '9.0.0')
		}
	})
})

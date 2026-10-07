const { assert } = require('chai')
const fs = require('fs')
const os = require('os')
const { join } = require('path')

// Runs src/aws/index.js against a throwaway HOME and the fake AWS CLI (test/fixtures/bin/aws).
;(process.platform == 'win32' ? describe.skip : describe)('aws', function() {
	this.timeout(15000)
	const SRC = join(__dirname, '..', 'src')
	const saved = {}
	let home, aws
	const calls = () => fs.readFileSync(join(home, 'aws-calls.log'), 'utf8').split('\n').filter(l => l.startsWith('configure sso'))

	before(() => {
		for (const k of ['HOME', 'PATH', 'SSH_CONNECTION', 'DISPLAY'])
			saved[k] = process.env[k]
		home = fs.mkdtempSync(join(os.tmpdir(), 'sp-aws-'))
		fs.mkdirSync(join(home, '.aws'))
		fs.writeFileSync(join(home, '.aws', 'config'), '')
		process.env.HOME = home
		process.env.PATH = `${join(__dirname, 'fixtures', 'bin')}:${process.env.PATH}`
		Object.keys(require.cache).filter(k => k.startsWith(SRC) && !k.endsWith('log.js')).forEach(k => delete require.cache[k])
		aws = require('../src/aws')
	})

	after(() => {
		for (const [k, v] of Object.entries(saved))
			v === undefined ? delete process.env[k] : process.env[k] = v
		Object.keys(require.cache).filter(k => k.startsWith(SRC) && !k.endsWith('log.js')).forEach(k => delete require.cache[k])
		fs.rmSync(home, { recursive:true, force:true })
	})

	it('Should run aws configure sso with a device code over SSH, and stamp the new profile', async () => {
		process.env.SSH_CONNECTION = '1.2.3.4 5 6.7.8.9 22'
		const [errors, upgraded] = await aws.createSsoProfile('remote-one')
		assert.isNull(errors)
		assert.isFalse(upgraded)
		assert.equal(calls().pop(), 'configure sso --profile remote-one --use-device-code --no-browser')
		assert.include(fs.readFileSync(join(home, '.aws', 'config'), 'utf8'), 'switch_profile_version')
	})

	it('Should let aws configure sso use the browser when the login mode says so', async () => {
		const [errors] = await aws.createSsoProfile('browser-one', { loginMode:'browser' })
		assert.isNull(errors)
		assert.equal(calls().pop(), 'configure sso --profile browser-one')
	})

	it('Should keep the AWS CLI output on a failed aws configure sso', async () => {
		process.env.FAKE_CONFIGURE_FAIL = '1'
		try {
			const [errors] = await aws.createSsoProfile('broken')
			assert.include(errors[0].output, 'Invalid start url provided')
		} finally {
			delete process.env.FAKE_CONFIGURE_FAIL
		}
	})
})

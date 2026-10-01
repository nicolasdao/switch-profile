const { assert } = require('chai')
const { loginFlags, resolveLoginMode } = require('../src/aws/login')

describe('login', () => {
	const ssh = { SSH_CONNECTION:'1.2.3.4 5 6.7.8.9 22' }
	it('Should use device code over SSH in auto mode', () => {
		assert.deepEqual(loginFlags('auto', { env:ssh, platform:'linux', cliVersion:'2.33.17' }), ['--use-device-code'])
		assert.deepEqual(loginFlags('auto', { env:{}, platform:'darwin', cliVersion:'2.33.17' }), [])
	})
	it('Should treat a Linux machine without a display as remote', () => {
		assert.equal(resolveLoginMode('auto', { env:{}, platform:'linux' }), 'device')
		assert.equal(resolveLoginMode('auto', { env:{ DISPLAY:':0' }, platform:'linux' }), 'browser')
	})
	it('Should honor explicit modes', () => {
		assert.deepEqual(loginFlags('device', { env:{}, platform:'darwin', cliVersion:'2.22.0' }), ['--use-device-code'])
		assert.deepEqual(loginFlags('browser', { env:ssh, platform:'linux', cliVersion:'2.33.0' }), [])
	})
	it('Should never pass the flag to CLIs older than 2.22.0', () => {
		assert.deepEqual(loginFlags('device', { env:ssh, platform:'linux', cliVersion:'2.21.9' }), [])
		assert.deepEqual(loginFlags('device', { env:ssh, platform:'linux', cliVersion:'2.9.0' }), [])
	})
})

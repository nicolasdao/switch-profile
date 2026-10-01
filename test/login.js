const { assert } = require('chai')
const { loginFlags, resolveLoginMode, parseLoginOutput } = require('../src/aws/login')

describe('login', () => {
	const ssh = { SSH_CONNECTION:'1.2.3.4 5 6.7.8.9 22' }
	it('Should use device code over SSH in auto mode', () => {
		assert.deepEqual(loginFlags('auto', { env:ssh, platform:'linux', cliVersion:'2.33.17' }), ['--use-device-code', '--no-browser'])
		assert.deepEqual(loginFlags('auto', { env:{}, platform:'darwin', cliVersion:'2.33.17' }), [])
	})
	it('Should treat a Linux machine without a display as remote', () => {
		assert.equal(resolveLoginMode('auto', { env:{}, platform:'linux' }), 'device')
		assert.equal(resolveLoginMode('auto', { env:{ DISPLAY:':0' }, platform:'linux' }), 'browser')
	})
	it('Should honor explicit modes', () => {
		assert.deepEqual(loginFlags('device', { env:{}, platform:'darwin', cliVersion:'2.22.0' }), ['--use-device-code', '--no-browser'])
		assert.deepEqual(loginFlags('browser', { env:ssh, platform:'linux', cliVersion:'2.33.0' }), [])
	})
	it('Should never pass the flag to CLIs older than 2.22.0', () => {
		assert.deepEqual(loginFlags('device', { env:ssh, platform:'linux', cliVersion:'2.21.9' }), [])
		assert.deepEqual(loginFlags('device', { env:ssh, platform:'linux', cliVersion:'2.9.0' }), [])
	})
	it('Should parse the device code output of aws sso login', () => {
		const out = 'Browser will not be automatically opened.\nPlease visit the following URL:\n\nhttps://device.sso.us-east-1.amazonaws.com/\n\nThen enter the code:\n\nABCD-EFGH\n\nAlternatively, you may visit the following URL which will autofill the code upon loading:\nhttps://device.sso.us-east-1.amazonaws.com/?user_code=ABCD-EFGH\n'
		assert.deepEqual(parseLoginOutput(out), {
			url: 'https://device.sso.us-east-1.amazonaws.com/',
			code: 'ABCD-EFGH',
			completeUrl: 'https://device.sso.us-east-1.amazonaws.com/?user_code=ABCD-EFGH'
		})
		assert.deepEqual(parseLoginOutput('Please visit the following URL:\n\nhttps://device.sso.us-east-1.amazonaws.com/\n'), {
			url: 'https://device.sso.us-east-1.amazonaws.com/', code: null, completeUrl: null
		})
		assert.deepEqual(parseLoginOutput(''), { url:null, code:null, completeUrl:null })
	})
})

const { assert } = require('chai')
const fs = require('fs')
const os = require('os')
const { join } = require('path')

// A fresh copy of src/log.js writing to its own temp file (the module remembers whether it rotated).
const freshLog = () => {
	const file = join(fs.mkdtempSync(join(os.tmpdir(), 'sp-log-')), 'switch-profile.log')
	process.env.SWITCH_PROFILE_LOG_FILE = file
	delete require.cache[require.resolve('../src/log')]
	return { log:require('../src/log'), file, read:() => fs.readFileSync(file, 'utf8') }
}

describe('log', () => {
	const original = process.env.SWITCH_PROFILE_LOG_FILE
	after(() => {
		process.env.SWITCH_PROFILE_LOG_FILE = original
		delete require.cache[require.resolve('../src/log')]
	})

	it('Should redact secrets from text and command arguments', () => {
		const { log } = freshLog()
		assert.equal(log.redact('aws_secret_access_key = abc123'), 'aws_secret_access_key = ***')
		assert.equal(log.redact('{"accessToken": "eyJhbGciOi", "region":"us-east-1"}'), '{"accessToken": "***", "region":"us-east-1"}')
		assert.equal(log.redact('aws sso list-accounts --access-token tok123 --region x'), 'aws sso list-accounts --access-token *** --region x')
		assert.deepEqual(log.redactArgs(['sso', 'list-accounts', '--access-token', 'tok123', '--region', 'x']), ['sso', 'list-accounts', '--access-token', '***', '--region', 'x'])
		assert.equal(log.redact(null), '')
	})

	it('Should describe an error with its hint, output, wrapped errors and cause chain', () => {
		const { log } = freshLog()
		const root = Object.assign(new Error('Invalid start url provided'), { output:'aws: [ERROR]: An error occurred (InvalidRequestException)', command:'aws configure sso --profile x', code:252 })
		const err = Object.assign(new Error('aws configure sso failed', { cause:root }), { hint:'Check the SSO region', exitCode:1, errors:[new Error('wrapped one')] })
		const text = log.describeError(err)
		for (const part of ['Error: aws configure sso failed', 'hint: Check the SSO region', 'exit code: 1', 'wrapped:', 'wrapped one', 'caused by:', 'Invalid start url provided', 'command: aws configure sso --profile x', 'code: 252', 'InvalidRequestException', 'test/log.js'])
			assert.include(text, part)
		assert.include(log.describeError('plain string'), 'plain string')
	})

	it('Should append runs, commands and errors to the log file', () => {
		const { log, read } = freshLog()
		log.start({ version:'9.9.9', argv:['node', 'index.js', 'add'] })
		log.command({ cmd:'aws', args:['sts', 'get-caller-identity'], code:0, ms:12 })
		log.command({ cmd:'aws', args:['sso', 'list-accounts', '--access-token', 'tok123'], code:255, ms:40, output:'Error: token expired' })
		log.error('add failed', new Error('boom'))
		const text = read()
		assert.match(text, /^\S+Z \[\d+\] INFO {2}run switch-profile 9\.9\.9 add\n/)
		assert.include(text, 'exec aws sts get-caller-identity → ok in 12ms')
		assert.include(text, 'WARN  exec aws sso list-accounts --access-token *** → exit 255 in 40ms\n    Error: token expired')
		assert.include(text, 'ERROR add failed\n  Error: boom')
		assert.notInclude(text, 'tok123')
	})

	it('Should log tolerated failures and return the fallback', async () => {
		const { log, read } = freshLog()
		assert.equal(await Promise.reject(new Error('EACCES')).catch(log.tolerated('reading the sp status', 'fallback')), 'fallback')
		assert.include(read(), 'WARN  reading the sp status failed (ignored)\n  Error: EACCES')
	})

	it('Should rotate the file when a run starts past the size cap, and never throw', () => {
		const { log, file, read } = freshLog()
		fs.writeFileSync(file, 'x'.repeat(log.MAX_BYTES + 1))
		log.info('new run')
		assert.isTrue(fs.existsSync(`${file}.1`))
		assert.match(read(), /^\S+ \[\d+\] INFO {2}new run\n$/)

		process.env.SWITCH_PROFILE_LOG_FILE = join(file, 'not-a-dir', 'x.log')
		assert.doesNotThrow(() => log.error('cannot write', new Error('x')))
	})

	it('Should show the log path with ~ for the home directory', () => {
		const { log } = freshLog()
		process.env.SWITCH_PROFILE_LOG_FILE = join(os.homedir(), '.switch-profile', 'switch-profile.log')
		assert.equal(log.displayPath(), join('~', '.switch-profile', 'switch-profile.log'))
	})
})

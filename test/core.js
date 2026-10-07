const { assert } = require('chai')
const { catchErrors, wrapErrors, run, lastErrorLine } = require('../src/core')

describe('core', () => {
	it('Should resolve successes as [null, value]', async () => {
		assert.deepEqual(await catchErrors(Promise.resolve(42)), [null, 42])
		assert.deepEqual(await catchErrors((async () => 'ok')()), [null, 'ok'])
	})

	it('Should flatten wrapped error chains into a list, outermost first', async () => {
		const [errors] = await catchErrors((async () => {
			throw wrapErrors('Fail to switch', [wrapErrors('Fail to read config', [new Error('EACCES')])])
		})())
		assert.deepEqual(errors.map(e => e.message), ['Fail to switch', 'Fail to read config', 'EACCES'])
		errors.forEach(e => assert.instanceOf(e, Error))
	})

	it('Should turn non-Error rejections into Errors', async () => {
		const [errors] = await catchErrors(Promise.reject('boom'))
		assert.equal(errors[0].message, 'boom')
	})

	it('Should run commands and fail on a non-zero exit code, not on stderr', async () => {
		assert.equal((await run(process.execPath, ['-e', 'console.error("noise"); console.log("out")'])).trim(), 'out')
		try {
			await run(process.execPath, ['-e', 'console.error("bad thing"); process.exit(3)'])
			assert.fail('should have thrown')
		} catch(err) {
			assert.equal(err.message, 'bad thing')
		}
	}).timeout(15000)

	it('Should keep the command, exit code and full output on a failed run', async () => {
		const err = await run(process.execPath, ['-e', 'console.error("line 1\\nline 2\\nline 3\\nerror: invalid_request\\nerror_description: Invalid start url provided"); process.exit(252)']).catch(e => e)
		assert.equal(err.message, 'error: invalid_request\nerror_description: Invalid start url provided')
		assert.equal(err.code, 252)
		assert.include(err.command, process.execPath)
		assert.include(err.output, 'line 1')
	}).timeout(15000)

	it('Should pick the telling lines of a failed command\'s output', () => {
		assert.equal(lastErrorLine(''), '')
		assert.equal(lastErrorLine('short\noutput'), 'short\noutput')
		assert.equal(lastErrorLine('a\nb\nc\nAn error occurred (X)\nd'), 'An error occurred (X)')
		assert.equal(lastErrorLine('a\nb\nc\nd'), 'a\nb\nc\nd')
	})
})

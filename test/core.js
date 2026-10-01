const { assert } = require('chai')
const { catchErrors, wrapErrors, run } = require('../src/core')

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
	})
})

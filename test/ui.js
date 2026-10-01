const { assert } = require('chai')
const ui = require('../src/ui')

describe('ui', () => {
	it('Should pad and truncate plain text to a width', () => {
		assert.equal(ui.fit('abc', 5), 'abc  ')
		assert.equal(ui.fit('abcdef', 4).length, 4)
		assert.equal(ui.fit(null, 2), '  ')
	})

	it('Should describe how long ago something happened', () => {
		const ago = ms => ui.ago(new Date(Date.now() - ms))
		assert.equal(ago(10 * 1000), 'just now')
		assert.equal(ago(5 * 60 * 1000), '5m ago')
		assert.equal(ago(3 * 3600 * 1000), '3h ago')
		assert.equal(ago(3 * 24 * 3600 * 1000), '3d ago')
		assert.equal(ui.ago('not a date'), '')
	})

	it('Should never be interactive with --no-input or in CI', () => {
		assert.isFalse(ui.isInteractive({ input:false }))
		const ci = process.env.CI
		process.env.CI = 'true'
		try {
			assert.isFalse(ui.isInteractive({}))
		} finally {
			if (ci === undefined)
				delete process.env.CI
			else
				process.env.CI = ci
		}
	})

	it('Should carry a hint and an exit code on CLI errors', () => {
		const err = new ui.CliError('No profile matches', { hint:'try status', code:3 })
		assert.equal(err.exitCode, 3)
		assert.equal(err.hint, 'try status')
		assert.equal(new ui.CliError('x').exitCode, 1)
	})
})

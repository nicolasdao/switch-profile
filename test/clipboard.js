const { assert } = require('chai')
const { osc52 } = require('../src/clipboard')

describe('clipboard', () => {
	it('Should build the OSC 52 sequence', () => {
		assert.equal(osc52('WXYZ-ABCD', {}), '\x1b]52;c;V1hZWi1BQkNE\x07')
	})
	it('Should add a tmux passthrough copy inside tmux', () => {
		const seq = osc52('hi', { TMUX:'/tmp/tmux-1/default,1,0' })
		assert.isTrue(seq.startsWith('\x1b]52;c;aGk=\x07'))
		assert.include(seq, '\x1bPtmux;\x1b\x1b]52;c;aGk=\x07\x1b\\')
	})
})

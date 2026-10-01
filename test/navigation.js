const { assert } = require('chai')
const { CANCEL_SYMBOL } = require('@clack/prompts')
const { routeChoice, afterPage } = require('../src/commands/switch')
const { CancelError } = require('../src/commands/common')
const { CliError } = require('../src/ui')
const { ACTION_PREFIX } = require('../src/home')

describe('navigation', () => {
	it('Should route the home screen answer', () => {
		assert.deepEqual(routeChoice(CANCEL_SYMBOL), { type:'quit' })
		assert.deepEqual(routeChoice('acme-prod'), { type:'switch', name:'acme-prod' })
		assert.deepEqual(routeChoice(ACTION_PREFIX + 'settings'), { type:'page', key:'settings' })
	})

	it('Should end the session only when a page switched profile', () => {
		assert.equal(afterPage({ switched:true }), 'exit')
		assert.equal(afterPage(undefined), 'home')
		assert.equal(afterPage({}), 'home')
	})

	it('Should go back on Esc, show expected errors, and rethrow the rest', () => {
		assert.equal(afterPage(undefined, new CancelError('Cancelled')), 'back')
		assert.equal(afterPage(undefined, new CliError('No default profile')), 'error')
		assert.equal(afterPage(undefined, new TypeError('bug')), 'throw')
	})
})

const { assert } = require('chai')
const { CANCEL_SYMBOL } = require('@clack/prompts')
const { routeChoice, afterPage } = require('../src/commands/switch')
const { CancelError } = require('../src/commands/common')
const { CliError } = require('../src/ui')
const { ACTION_PREFIX } = require('../src/home')
const { portalOfError, recoveryOptions } = require('../src/commands/recovery')

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

	describe('error screen', () => {
		const sessions = [{ name:'acme', sso_start_url:'https://acme.awsapps.com/start', sso_region:'us-east-1' }]
		const profiles = [{ name:'acme-dev', sso_session:'acme' }, { name:'keys' }]
		const acme = { name:'acme', startUrl:'https://acme.awsapps.com/start', region:'us-east-1' }

		it('Should find the portal of a failed login, by session or by profile', () => {
			assert.deepEqual(portalOfError(Object.assign(new Error(), { target:{ ssoSession:'acme' } }), profiles, sessions), acme)
			assert.deepEqual(portalOfError(Object.assign(new Error(), { target:{ profile:'acme-dev' } }), profiles, sessions), acme)
			assert.isNull(portalOfError(Object.assign(new Error(), { target:{ profile:'keys' } }), profiles, sessions))
			assert.isNull(portalOfError(new Error('no target'), profiles, sessions))
		})

		it('Should offer the region fix first, only when the portal names another region', () => {
			const values = o => recoveryOptions(o).map(x => x.value)
			assert.deepEqual(values({ portal:acme, wrongRegion:true, detectedRegion:'ap-southeast-2' }), ['fix-region', 'edit-portal', 'retry', 'back'])
			assert.include(recoveryOptions({ portal:acme, wrongRegion:true, detectedRegion:'ap-southeast-2' })[0].label, 'ap-southeast-2')
			assert.deepEqual(values({ portal:acme, wrongRegion:true, detectedRegion:'us-east-1' }), ['edit-portal', 'retry', 'back'])
			assert.deepEqual(values({ portal:acme, wrongRegion:true, detectedRegion:null }), ['edit-portal', 'retry', 'back'])
			assert.deepEqual(values({ portal:acme, wrongRegion:false, detectedRegion:'ap-southeast-2' }), ['edit-portal', 'retry', 'back'])
			assert.deepEqual(values({ portal:null }), ['retry', 'back'])
		})
	})
})

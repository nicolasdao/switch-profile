const { assert } = require('chai')
const { PassThrough, Writable } = require('stream')
const { isCancel } = require('@clack/prompts')
const { home, nextFocus, ACTION_PREFIX } = require('../src/home')

const ACTIONS = [{ key:'login', label:'Log in' }, { key:'add', label:'Add' }, { key:'settings', label:'Settings' }]
const PROFILES = ['acme-prod', 'acme-dev', 'globex-readonly']

// Drives the real prompt with simulated keystrokes and captures what it draws.
const drive = (keys, { profiles = PROFILES } = {}) => {
	const input = new PassThrough()
	let screen = ''
	const output = new Writable({ write(chunk, enc, next) { screen += chunk; next() } })
	output.columns = 100
	output.rows = 40
	const result = home({
		message: 'Switch to',
		actions: ACTIONS,
		maxItems: 10,
		input,
		output,
		rows: query => profiles.filter(n => n.includes(query)).map(n => ({ value:n, label:n }))
	})
	let i = 0
	const next = () => {
		if (i < keys.length) {
			input.write(keys[i++])
			setTimeout(next, 20)
		}
	}
	setTimeout(next, 20)
	return result.then(value => ({ value, screen }))
}

const TAB = '\t', RIGHT = '\x1b[C', LEFT = '\x1b[D', DOWN = '\x1b[B', ENTER = '\r', ESC = '\x1b'

describe('home', () => {
	describe('nextFocus', () => {
		const list = { area:'list', index:0, count:3, hasRows:true }
		it('Should toggle between the list and the action bar with Tab', () => {
			assert.equal(nextFocus(list, { name:'tab' }).area, 'actions')
			assert.equal(nextFocus({ ...list, area:'actions' }, { name:'tab' }).area, 'list')
		})
		it('Should stay on the action bar when there are no rows', () => {
			assert.equal(nextFocus({ ...list, area:'actions', hasRows:false }, { name:'tab' }).area, 'actions')
			assert.equal(nextFocus({ ...list, area:'actions', hasRows:false }, { name:'up' }).area, 'actions')
		})
		it('Should move between actions with wrap-around', () => {
			const bar = { ...list, area:'actions' }
			assert.equal(nextFocus(bar, { name:'left' }).index, 2)
			assert.equal(nextFocus({ ...bar, index:2 }, { name:'right' }).index, 0)
		})
		it('Should submit on Enter only from the action bar', () => {
			assert.isTrue(nextFocus({ ...list, area:'actions' }, { name:'return' }).submit)
			assert.isUndefined(nextFocus(list, { name:'return' }).submit)
		})
		it('Should go back to the list when typing or pressing up/down', () => {
			assert.equal(nextFocus({ ...list, area:'actions' }, { name:'a', char:'a' }).area, 'list')
			assert.equal(nextFocus({ ...list, area:'actions' }, { name:'down' }).area, 'list')
			assert.equal(nextFocus(list, { name:'left' }).area, 'list', 'left/right move the text cursor in the list')
		})
	})

	describe('prompt', function() {
		this.timeout(10000)
		it('Should switch to the focused profile on Enter', async () => {
			assert.equal((await drive([ENTER])).value, 'acme-prod')
			assert.equal((await drive([DOWN, ENTER])).value, 'acme-dev')
		})
		it('Should filter by the search text', async () => {
			assert.equal((await drive(['g', 'l', 'o', ENTER])).value, 'globex-readonly')
		})
		it('Should open the focused action', async () => {
			assert.equal((await drive([TAB, ENTER])).value, ACTION_PREFIX + 'login')
			assert.equal((await drive([TAB, RIGHT, RIGHT, ENTER])).value, ACTION_PREFIX + 'settings')
			assert.equal((await drive([TAB, LEFT, ENTER])).value, ACTION_PREFIX + 'settings')
		})
		it('Should go back to the list from the action bar', async () => {
			assert.equal((await drive([TAB, TAB, DOWN, ENTER])).value, 'acme-dev')
		})
		it('Should always draw the action bar and the key hints', async () => {
			const { screen } = await drive([ENTER])
			assert.include(screen, 'Settings')
			assert.include(screen, 'tab actions')
		})
		it('Should quit with Esc', async () => {
			assert.isTrue(isCancel((await drive([ESC])).value))
		})
		it('Should start on the action bar when there are no profiles', async () => {
			assert.equal((await drive([RIGHT, ENTER], { profiles:[] })).value, ACTION_PREFIX + 'add')
		})
	})
})

/**
 * The home screen: a search box over the profiles, plus an action bar that is always visible below the list,
 * however many profiles there are.
 *
 * 	- typing filters and ranks profiles, ↑↓ moves, Enter switches (the common path stays one step)
 * 	- Tab moves focus to the action bar, ←→ choose an action, Enter opens it, Tab or typing goes back
 * 	- Esc quits
 *
 * Built on @clack/core's AutocompletePrompt (typing, cursor, list navigation) with its own render, so it looks
 * like the other clack prompts.
 */
const { AutocompletePrompt } = require('@clack/core')
const { S_BAR, S_BAR_END, S_RADIO_ACTIVE, S_RADIO_INACTIVE, symbol, limitOptions } = require('@clack/prompts')
const ui = require('./ui')

const ACTION_PREFIX = '__action__:'

/**
 * Pure: the key handling of the action bar.
 *
 * @param  {Object} state	{ area: 'list'|'actions', index, count, hasRows }
 * @param  {Object} key		readline key ({ name }) and the typed character
 * @return {Object} next state, plus `submit: true` when Enter opens the focused action
 */
const nextFocus = (state, { name, char }) => {
	const { area, index, count, hasRows } = state
	if (name == 'tab')
		return { ...state, area: area == 'list' || !hasRows ? 'actions' : 'list' }
	if (area != 'actions')
		return state
	if (name == 'left')
		return { ...state, index: (index - 1 + count) % count }
	if (name == 'right')
		return { ...state, index: (index + 1) % count }
	if (name == 'return')
		return { ...state, submit: true }
	if ((name == 'up' || name == 'down') && hasRows)
		return { ...state, area: 'list' }
	// Typing goes back to the search box.
	if (char && char.length == 1 && char >= ' ' && hasRows)
		return { ...state, area: 'list' }
	return state
}

class HomePrompt extends AutocompletePrompt {
	constructor(opts) {
		super(opts)
		this.actions = opts.actions
		this.area = this.options.length ? 'list' : 'actions'
		this.actionIndex = 0
		this.on('key', (char, key) => {
			const next = nextFocus(
				{ area: this.area, index: this.actionIndex, count: this.actions.length, hasRows: this.filteredOptions.length > 0 },
				{ name: key && key.name, char }
			)
			this.area = next.area
			this.actionIndex = next.index
			// Runs after the base handler, so it overrides the profile it picked.
			if (next.submit)
				this.value = ACTION_PREFIX + this.actions[this.actionIndex].key
		})
	}
}

const actionBar = (actions, focused) => actions
	.map((a, i) => {
		const label = ` ${a.label} `
		return i === focused ? ui.style(['inverse', 'cyan'], label) : ui.dim(`[${label.trim()}]`)
	})
	.join(' ')

/**
 * Shows the home screen.
 *
 * @param  {String}   options.message
 * @param  {Function} options.rows			(query) => [{ value, label, hint }] already filtered and ranked
 * @param  {Array}    options.actions		[{ key, label }]
 * @param  {String}   options.initialQuery
 * @param  {Number}   options.maxItems
 * @param  {Stream}   options.input		Defaults to stdin (tests pass their own)
 * @param  {Stream}   options.output	Defaults to stdout
 * @return {String|Symbol}	a profile name, ACTION_PREFIX + action key, or the clack cancel symbol
 */
const home = ({ message, rows, actions, initialQuery, maxItems, input, output }) => new HomePrompt({
	actions,
	input,
	output,
	initialUserInput: initialQuery || undefined,
	options() {
		return rows(this.userInput || '')
	},
	validate: value => value === undefined ? 'Nothing matches: change the search, or press Tab for actions.' : undefined,
	render() {
		const gray = s => ui.style('gray', s)
		const title = `${gray(S_BAR)}\n${symbol(this.state)}  ${message}`
		if (this.state == 'submit') {
			const v = String(this.value || '')
			// An action collapses into a breadcrumb for the page that follows.
			if (v.startsWith(ACTION_PREFIX)) {
				const label = (actions.find(a => ACTION_PREFIX + a.key == v) || {}).label || ''
				return `${gray(S_BAR)}\n${symbol(this.state)}  ${ui.dim('switch-profile ›')} ${ui.strong(label)}`
			}
			return `${title}\n${gray(S_BAR)}  ${ui.dim(v)}`
		}
		if (this.state == 'cancel')
			return `${title}\n${gray(S_BAR)}`

		const bar = ui.style(this.state == 'error' ? 'yellow' : 'cyan', S_BAR)
		const end = ui.style(this.state == 'error' ? 'yellow' : 'cyan', S_BAR_END)
		const onList = this.area == 'list'
		const count = this.filteredOptions.length
		const lines = [title]
		lines.push(`${bar}  ${ui.dim('Search:')} ${this.userInputWithCursor}${this.userInput ? ui.dim(`  (${count} match${count == 1 ? '' : 'es'})`) : ''}`)

		if (count) {
			const rendered = limitOptions({
				cursor: this.cursor,
				options: this.filteredOptions,
				maxItems,
				output: this.output,
				rowPadding: 8,
				style: (option, active) => active && onList
					? `${ui.style('green', S_RADIO_ACTIVE)} ${option.label}${option.hint ? ui.dim(`  ${option.hint}`) : ''}`
					: `${ui.dim(S_RADIO_INACTIVE)} ${ui.dim(option.label)}`
			})
			rendered.forEach(line => lines.push(`${bar}  ${line}`))
		} else
			lines.push(`${bar}  ${ui.warn(this.options.length ? 'No matches' : 'No profiles yet: Tab to Add')}`)

		lines.push(bar)
		lines.push(`${bar}  ${actionBar(actions, onList ? -1 : this.actionIndex)}`)
		if (this.state == 'error')
			lines.push(`${bar}  ${ui.warn(this.error)}`)
		lines.push(`${end}  ${ui.dim(onList
			? '↑↓ choose · enter switch · tab actions · esc quit'
			: '←→ choose · enter open · tab back to the list · esc quit')}`)
		return lines.join('\n')
	}
}).prompt()

module.exports = {
	ACTION_PREFIX,
	nextFocus,
	home
}

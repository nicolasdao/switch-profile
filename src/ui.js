/**
 * Terminal UI helpers: colors, symbols, interactivity detection and error formatting.
 *
 * Colors use Node's built-in util.styleText and are disabled when the output is not a TTY, or when NO_COLOR
 * is set, or TERM=dumb. FORCE_COLOR forces them on.
 */
const { styleText } = require('node:util')
const log = require('./log')

const env = process.env

const colorEnabled = () => {
	if (env.FORCE_COLOR && env.FORCE_COLOR !== '0')
		return true
	if (env.NO_COLOR || env.TERM == 'dumb')
		return false
	return !!process.stdout.isTTY
}

const style = (format, text) => colorEnabled() ? styleText(format, String(text)) : String(text)

const unicode = process.platform !== 'win32' || !!env.WT_SESSION || env.TERM_PROGRAM == 'vscode' || !!env.TERMINAL_EMULATOR

const sym = {
	ok: unicode ? '✓' : 'v',
	err: unicode ? '✗' : 'x',
	warn: unicode ? '▲' : '!',
	dot: unicode ? '●' : '*',
	sep: unicode ? '·' : '-',
	arrow: unicode ? '→' : '->'
}

const ui = {
	style,
	sym,
	unicode,
	accent: s => style('cyan', s),
	strong: s => style('bold', s),
	dim: s => style('dim', s),
	ok: s => style('green', s),
	warn: s => style('yellow', s),
	bad: s => style('red', s),
	code: s => style(['bold', 'yellow'], s),
	prodBadge: () => style(['bold', 'red'], 'PROD'),
	badge: s => style(['bgCyan', 'black'], ` ${s} `),
	join: parts => parts.filter(Boolean).join(` ${style('dim', sym.sep)} `),
	/**
	 * Pads/truncates plain (unstyled) text to a width.
	 */
	fit: (text, width) => {
		text = String(text || '')
		if (text.length > width)
			return width > 1 ? text.slice(0, width-1) + (unicode ? '…' : '~') : text.slice(0, width)
		return text + ' '.repeat(width - text.length)
	},
	columns: () => process.stdout.columns || 100
}

/**
 * True when the user can answer prompts.
 */
const isInteractive = options => {
	if (options && options.input === false)
		return false
	if (env.CI && env.CI !== 'false')
		return false
	return !!(process.stdin.isTTY && process.stdout.isTTY)
}

/**
 * Error carrying a human hint and an exit code.
 * 	exit codes: 1 general, 2 login required, 3 bad input / not found, 130 cancelled
 */
class CliError extends Error {
	constructor(message, { hint, code, cause, errors } = {}) {
		super(message)
		this.name = 'CliError'
		this.hint = hint
		this.exitCode = code || 1
		this.cause = cause
		this.errors = errors
	}
}

/**
 * A CliError from the [errors] arrays returned by catchErrors (src/core.js). The original errors stay attached,
 * so the log (src/log.js) records their stacks and output, not just the message.
 */
const cliErrorFrom = (errors, options) => new CliError(errorsMessage(errors), { ...options, errors })

const debugEnabled = () => !!(env.SWITCH_PROFILE_DEBUG || (env.DEBUG && /switch-profile|\*/.test(env.DEBUG)))

/**
 * Turns the [errors] arrays returned by catchErrors (src/core.js) into one readable message.
 */
const errorsMessage = errors => (errors || [])
	.map(e => (e && e.message) || String(e))
	.filter(Boolean)
	.join('\n')

const printError = err => {
	const lines = [`${ui.bad(sym.err)} ${err.message || String(err)}`]
	if (err.hint)
		lines.push(`  ${ui.dim(err.hint)}`)
	if (debugEnabled() && err.stack)
		lines.push(ui.dim(err.stack))
	// Exit codes 2 (login required) and 3 (bad input) come with their own fix in the hint. They are logged too.
	if (!(err instanceof CliError) || err.exitCode == 1)
		lines.push(`  ${ui.dim(`Details: ${log.displayPath()}`)}`)
	console.error(lines.join('\n'))
}

/**
 * "3h ago", "2d ago", "just now".
 */
const ago = date => {
	const ms = Date.now() - new Date(date).getTime()
	if (isNaN(ms))
		return ''
	const m = Math.floor(ms / 60000)
	if (m < 1)
		return 'just now'
	if (m < 60)
		return `${m}m ago`
	const h = Math.floor(m / 60)
	if (h < 48)
		return `${h}h ago`
	return `${Math.floor(h / 24)}d ago`
}

/**
 * A clack spinner on interactive terminals. Elsewhere (pipes, CI, agents) or with ACCESSIBLE set, a static
 * stand-in that only prints the outcome: animations are noise in logs and confuse screen readers.
 */
const spinner = options => {
	const p = require('@clack/prompts')
	if (process.stdout.isTTY && !env.ACCESSIBLE)
		return p.spinner(options)
	const accessible = process.stdout.isTTY
	return {
		start: msg => accessible && msg && p.log.step(`${msg}…`),
		message: () => {},
		stop: msg => msg && p.log.success(msg),
		error: msg => msg && p.log.error(msg),
		cancel: msg => msg && p.log.warn(msg),
		clear: () => {},
		isCancelled: false
	}
}

/**
 * A spinner with an elapsed-time counter that, unlike clack's, leaves stdin alone, so the caller can handle
 * keypresses (clack's spinner exits the process on Ctrl+C).
 */
const timerSpinner = () => {
	const p = require('@clack/prompts')
	if (!process.stdout.isTTY || env.ACCESSIBLE)
		return spinner()
	const frames = unicode ? ['◒', '◐', '◓', '◑'] : ['-', '\\', '|', '/']
	let timer = null
	let message = ''
	let started = 0
	let i = 0
	const clear = () => process.stdout.write('\r\x1b[2K')
	const render = () => {
		const s = Math.floor((Date.now() - started) / 1000)
		clear()
		process.stdout.write(`${style('magenta', frames[i++ % frames.length])}  ${message} ${style('dim', `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)}`)
	}
	const halt = () => {
		if (timer) {
			clearInterval(timer)
			timer = null
			clear()
			process.stdout.write('\x1b[?25h')
		}
	}
	return {
		start: msg => {
			message = msg || message
			started = started || Date.now()
			process.stdout.write('\x1b[?25l')
			render()
			timer = setInterval(render, unicode ? 80 : 120)
		},
		message: msg => { message = msg },
		stop: msg => { halt(); msg && p.log.success(msg) },
		error: msg => { halt(); msg && p.log.error(msg) },
		cancel: msg => { halt(); msg && p.log.warn(msg) },
		clear: halt,
		isCancelled: false
	}
}

module.exports = {
	...ui,
	spinner,
	timerSpinner,
	ui,
	colorEnabled,
	isInteractive,
	CliError,
	debugEnabled,
	errorsMessage,
	printError,
	cliErrorFrom,
	ago
}

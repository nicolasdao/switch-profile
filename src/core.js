const { exec, spawn } = require('child_process')
const log = require('./log')

/**
 * Error that carries the errors that caused it. catchErrors flattens the chain into a list.
 */
class WrappedError extends Error {
	constructor(message, errors) {
		super(message)
		this.errors = errors || []
	}
}

const wrapErrors = (message, errors) => new WrappedError(message, errors)

const flattenErrors = err => err instanceof WrappedError
	? [new Error(err.message), ...err.errors.flatMap(flattenErrors)]
	: [err instanceof Error ? err : new Error(String(err))]

/**
 * Resolves a promise into a tuple instead of throwing: [null, value] or [[...errors]].
 */
const catchErrors = promise => Promise.resolve(promise).then(value => [null, value], err => [flattenErrors(err)])

const IS_WINDOWS = process.platform == 'win32'

const _exec = cmd => new Promise((next,fail) => {
	const started = Date.now()
	exec(cmd, (error, stdout, stderr) => {
		log.command({ cmd, args:[], code: error ? (error.code ?? 1) : stderr ? 'stderr' : 0, ms:Date.now() - started, output:stderr || (error && error.message) })
		if (error || stderr)
			fail(error || stderr)
		else
			next(stdout)
	})
})

/**
 * Error of a child process that failed: carries the command, its exit code and its output, for the log.
 */
const commandError = (message, { command, exitCode, output }) => Object.assign(new Error(message), { command, code:exitCode, output })

/**
 * Runs a command without a shell (except on Windows, where 'aws'/'npx' are .cmd/.exe shims), and resolves
 * with its stdout. Unlike 'exec', output on stderr is not treated as a failure: only the exit code is.
 * Every run is logged (src/log.js), with its output when it fails.
 *
 * @param  {String}  cmd
 * @param  {Array}   args
 * @param  {Boolean} options.inherit	Default false. If true, the child uses this terminal (needed for prompts
 *                                   	and for the SSO login URL/code to be visible). Nothing is captured.
 * @param  {Boolean} options.tee		Like inherit, but stderr is also captured (still shown as it arrives),
 *                                   	so a failure carries the AWS CLI's error message.
 * @return {String}  stdout
 */
const run = (cmd, args, options) => new Promise((next, fail) => {
	const { inherit, tee } = options || {}
	const started = Date.now()
	const command = `${cmd} ${log.redactArgs(args).join(' ')}`.trim()
	const child = spawn(cmd, args || [], {
		stdio: tee ? ['inherit', 'inherit', 'pipe'] : inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
		...(IS_WINDOWS ? { shell:true } : {})
	})
	let stdout = ''
	let stderr = ''
	if (tee)
		child.stderr.on('data', d => {
			stderr += d
			process.stderr.write(d)
		})
	else if (!inherit) {
		child.stdout.on('data', d => stdout += d)
		child.stderr.on('data', d => stderr += d)
	}
	child.on('error', err => {
		log.command({ cmd, args, code:err.code || 'spawn error', ms:Date.now() - started, output:err.message, inherit:inherit || tee })
		fail(Object.assign(err, { command }))
	})
	child.on('close', code => {
		const output = (stderr || stdout || '').trim()
		log.command({ cmd, args, code, ms:Date.now() - started, output, inherit:inherit || tee })
		if (code === 0)
			next(stdout)
		else
			fail(commandError(lastErrorLine(output) || `'${command}' exited with code ${code}`, { command, exitCode:code, output }))
	})
})

/**
 * The most telling line of a failed command's output: the last line that looks like an error, else the
 * whole output (pure). AWS CLI errors end with lines such as 'error_description: Invalid start url provided'.
 */
const lastErrorLine = output => {
	const text = (output || '').trim()
	if (!text)
		return ''
	const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
	if (lines.length <= 3)
		return text
	const telling = lines.filter(l => /error|exception|denied|invalid|expired|unable|not found|failed/i.test(l))
	return telling.length ? telling.slice(-2).join('\n') : text
}

const _commandExistsResult = {}
const isCommandExist = (cmd, errorMsg) => () => catchErrors((async () => {
	if (!cmd)
		return false

	if (_commandExistsResult[cmd] !== undefined)
		return _commandExistsResult[cmd]

	const testCmd = IS_WINDOWS ? 'where' : 'which'
	const data = await _exec(`${testCmd} ${cmd}`).catch(() => false)

	if (!data)
		throw new Error(`Command ${cmd} not found${errorMsg ? `. ${errorMsg}` : ''}`)

	_commandExistsResult[cmd] = true
	return true
})())

module.exports = {
	catchErrors,
	wrapErrors,
	exec: _exec,
	run,
	lastErrorLine,
	isCommandExist
}
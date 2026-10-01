const { exec, spawn } = require('child_process')

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
	exec(cmd, (error, stdout, stderr) => {
		if (error || stderr)
			fail(error || stderr)
		else
			next(stdout)
	})
})

/**
 * Runs a command without a shell (except on Windows, where 'aws'/'npx' are .cmd/.exe shims), and resolves
 * with its stdout. Unlike 'exec', output on stderr is not treated as a failure: only the exit code is.
 *
 * @param  {String}  cmd
 * @param  {Array}   args
 * @param  {Boolean} options.inherit	Default false. If true, the child uses this terminal (needed for prompts
 *                                   	and for the SSO login URL/code to be visible). Nothing is captured.
 * @return {String}  stdout
 */
const run = (cmd, args, options) => new Promise((next, fail) => {
	const { inherit } = options || {}
	const child = spawn(cmd, args || [], {
		stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
		...(IS_WINDOWS ? { shell:true } : {})
	})
	let stdout = ''
	let stderr = ''
	if (!inherit) {
		child.stdout.on('data', d => stdout += d)
		child.stderr.on('data', d => stderr += d)
	}
	child.on('error', fail)
	child.on('close', code => {
		if (code === 0)
			next(stdout)
		else
			fail(new Error((stderr || stdout || '').trim() || `'${cmd} ${(args||[]).join(' ')}' exited with code ${code}`))
	})
})

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
	isCommandExist
}
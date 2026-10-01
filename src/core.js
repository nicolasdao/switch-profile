require('colors')
const { error: { catchErrors } } = require('puffy')
const { exec, spawn } = require('child_process')

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

/**
 * 
 * @param  {[Error]} errors					
 * @param  {Boolean} options.noStack
 * @return {String}
 */
const formatErrorMsg = (errors, options) => {
	if (!errors || !errors.length)
		return ''

	const noStack = options && options.noStack
	const msg = errors.map(e => noStack ? e.message||'' : e.stack||e.message||'').join('\n')
	const prefix = /^error/.test(msg.toLowerCase().trim()) ? '' : 'ERROR - '
	return `${prefix}${msg}`
}

const printErrors = (errors, options) => console.log(formatErrorMsg(errors, options).red)
const printAWSerrors = (errors, options) => {
	let msg = formatErrorMsg(errors, options)
	if (msg.indexOf('ommand aws not found') >= 0)
		msg += `\n\nTo fix this issue, try installing the ${'aws CLI'.bold}`
	
	console.log(msg.red)
}

module.exports = {
	exec: _exec,
	run,
	isCommandExist,
	printErrors,
	printAWSerrors
}
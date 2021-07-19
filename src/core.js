require('colors')
const { error: { catchErrors } } = require('puffy')
const { exec } = require('child_process')

const IS_WINDOWS = process.platform == 'win32'

const _exec = cmd => new Promise((next,fail) => {
	exec(cmd, (error, stdout, stderr) => {
		if (error || stderr)
			fail(error || stderr)
		else
			next(stdout)
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
	isCommandExist,
	printErrors,
	printAWSerrors
}
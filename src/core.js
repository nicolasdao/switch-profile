require('colors')
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
const isCommandExist = (cmd, errorMsg) => async () => {
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
}

const formatErrorMsg = errors => {
	if (!errors || !errors.length)
		return ''

	const msg = errors.map(e => e.stack||e.message||'').join('\n')
	const prefix = /^error/.test(msg.toLowerCase().trim()) ? '' : 'ERROR - '
	return `${prefix}${msg}`
}

const printErrors = errors => console.log(formatErrorMsg(errors).red)
const printAWSerrors = errors => {
	let msg = formatErrorMsg(errors)
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
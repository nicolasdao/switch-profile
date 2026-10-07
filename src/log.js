/**
 * Diagnostic log: ~/.switch-profile/switch-profile.log.
 *
 * Every run appends a header (version, command, platform), each AWS CLI call with its exit code and duration
 * (and its output when it fails), and every error with its full chain (stack, hint, exit code, cause, wrapped
 * errors). Errors shown on screen point here, so a failure can be diagnosed after the fact.
 *
 * Rules:
 * 	- Writes are synchronous, so nothing is lost when the process exits abruptly (clack exits on Ctrl+C).
 * 	- Logging never throws and never changes what the command does.
 * 	- Secrets are redacted (access tokens, client secrets, secret keys). See redact().
 * 	- The file is capped at MAX_BYTES: when a run starts past it, the file moves to switch-profile.log.1.
 */
const fs = require('fs')
const { homedir } = require('os')
const { join, dirname } = require('path')

// SWITCH_PROFILE_LOG_FILE overrides the location (the test suite uses it to keep logs out of the real home).
const logFile = () => process.env.SWITCH_PROFILE_LOG_FILE || join(homedir(), '.switch-profile', 'switch-profile.log')
const MAX_BYTES = 1024 * 1024
const MAX_OUTPUT = 4000

const SECRET_FLAGS = ['--access-token', '--client-secret', '--otp']
const SECRET_PATTERNS = [
	/((?:aws_secret_access_key|aws_session_token|aws_security_token)\s*[=:]\s*)\S+/gi,
	/("?(?:accessToken|refreshToken|clientSecret|secretAccessKey|sessionToken)"?\s*[=:]\s*"?)[^\s",}]+/gi,
	/(--(?:access-token|client-secret|otp)[=\s]+)\S+/gi
]

/**
 * Removes secrets from a string (pure).
 */
const redact = text => SECRET_PATTERNS.reduce((s, re) => s.replace(re, '$1***'), String(text == null ? '' : text))

/**
 * Removes the values of secret flags from command arguments (pure).
 */
const redactArgs = args => (args || []).map((a, i) => SECRET_FLAGS.includes(args[i-1]) ? '***' : redact(a))

const truncate = (text, max = MAX_OUTPUT) => {
	const s = String(text == null ? '' : text).trim()
	return s.length > max ? `…${s.slice(-max)}` : s
}

const indent = text => String(text).split('\n').map(l => `    ${l}`).join('\n')

/**
 * Describes an error and everything it carries, outermost first (pure).
 */
const describeError = (err, depth = 0) => {
	if (depth > 8)
		return '  (cause chain truncated)'
	if (!(err instanceof Error))
		return `  ${redact(typeof err == 'string' ? err : JSON.stringify(err))}`
	const lines = [`  ${err.name || 'Error'}: ${redact(err.message)}`]
	if (err.hint)
		lines.push(`  hint: ${redact(err.hint)}`)
	if (err.exitCode != null)
		lines.push(`  exit code: ${err.exitCode}`)
	if (err.command)
		lines.push(`  command: ${redact(err.command)}`)
	if (err.code != null && err.exitCode == null)
		lines.push(`  code: ${err.code}`)
	if (err.output)
		lines.push('  output:', indent(redact(truncate(err.output))))
	if (err.stack)
		lines.push(indent(redact(err.stack.split('\n').slice(1).join('\n').replace(/^\s+/gm, ''))))
	for (const e of err.errors || [])
		lines.push('  wrapped:', describeError(e, depth + 1))
	if (err.cause)
		lines.push('  caused by:', describeError(err.cause, depth + 1))
	return lines.join('\n')
}

let rotated = false
const write = (level, message, details) => {
	try {
		const file = logFile()
		if (!fs.existsSync(dirname(file)))
			fs.mkdirSync(dirname(file), { recursive:true, mode:0o700 })
		if (!rotated) {
			rotated = true
			const stat = fs.statSync(file, { throwIfNoEntry:false })
			if (stat && stat.size > MAX_BYTES)
				fs.renameSync(file, `${file}.1`)
		}
		const line = `${new Date().toISOString()} [${process.pid}] ${level.padEnd(5)} ${redact(message)}${details ? `\n${details}` : ''}\n`
		fs.appendFileSync(file, line, { mode:0o600 })
	} catch {
		// Logging must never break a command.
	}
}

const info = (message, details) => write('INFO', message, details && redact(details))
const warn = (message, details) => write('WARN', message, details && redact(details))

/**
 * Logs an error with its full chain.
 *
 * @param  {String} context		What was being done, e.g. 'add failed'
 * @param  {Error}  err
 */
const error = (context, err) => write('ERROR', context, describeError(err))

/**
 * A .catch() handler for failures that are tolerated (the command carries on with a fallback), so they are
 * still traceable: promise.catch(log.tolerated('reading the sp status', null)).
 */
const tolerated = (context, fallback) => err => {
	write('WARN', `${context} failed (ignored)`, describeError(err))
	return fallback
}

/**
 * Logs one child process run.
 */
const command = ({ cmd, args, code, ms, output, inherit }) => {
	const line = `${cmd} ${redactArgs(args).join(' ')}`.trim()
	const status = code === 0 ? 'ok' : `exit ${code}`
	const details = code !== 0 && output ? indent(redact(truncate(output))) : null
	write(code === 0 ? 'INFO' : 'WARN', `exec ${line} → ${status} in ${ms}ms${inherit ? ' (interactive)' : ''}`, details)
}

/**
 * Logs the start of a run.
 */
const start = ({ version, argv }) => write('INFO', `run switch-profile ${version} ${redactArgs((argv || []).slice(2)).join(' ')}`.trim(), indent([
	`node ${process.version} · ${process.platform} ${process.arch} · ${process.stdout.isTTY ? 'tty' : 'no tty'}${process.env.SSH_CONNECTION ? ' · ssh' : ''}`,
	`shell ${process.env.SWITCH_PROFILE_SHELL || process.env.SHELL || '?'}${process.env.SWITCH_PROFILE_ENV_FILE ? ' (via sp)' : ''}`
].join('\n')))

/**
 * ~/.switch-profile/switch-profile.log, with the home directory shortened to ~.
 */
const displayPath = () => {
	const file = logFile()
	const home = homedir()
	return file.startsWith(home + '/') || file.startsWith(home + '\\') ? `~${file.slice(home.length)}` : file
}

module.exports = {
	logFile,
	MAX_BYTES,
	redact,
	redactArgs,
	describeError,
	displayPath,
	start,
	info,
	warn,
	error,
	tolerated,
	command
}

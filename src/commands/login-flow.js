/**
 * The SSO login experience. Runs 'aws sso login', reads the URL and code it prints, and presents them:
 * the code is copied to the clipboard (over SSH, to the local terminal's clipboard via OSC 52), a QR code is
 * one keypress away, and a timer shows the wait. The browser is opened only on machines that have one.
 */
const { spawn } = require('child_process')
const p = require('@clack/prompts')
const { renderUnicodeCompact } = require('uqr')
const aws = require('../aws')
const settings = require('../settings')
const { parseLoginOutput, isRemoteSession, atLeast } = require('../aws/login')
const clipboard = require('../clipboard')
const ui = require('../ui')
const { CancelError } = require('./common')

const IS_WINDOWS = process.platform == 'win32'
const RAW_OUTPUT_AFTER_MS = 10000

const clipboardNote = result => result == 'local' ? ui.ok('📋 copied')
	: result == 'terminal' ? ui.dim('📋 sent to your clipboard')
		: ''

/**
 * @param  {Object}  target				{ profile } or { ssoSession }
 * @param  {String}  options.label		What is being logged in to (e.g., 'acme' or 'acme-prod')
 * @param  {String}  options.loginKey	Key used to remember when this login happened
 * @param  {Boolean} options.interactive
 * @param  {String}  options.loginMode	Overrides the setting ('device' | 'browser')
 */
const ssoLogin = async (target, { label, loginKey, interactive, loginMode }) => {
	const current = await settings.read()
	const args = await aws.ssoLoginArgs(target, loginMode || settings.getLoginMode(current))
	// Before AWS CLI 2.22, device code was the only flow (no flag, and no auto-fill URL is printed).
	const legacyCli = !atLeast(await aws.getAwsCliVersion(), [2, 22, 0])
	const device = args.includes('--use-device-code') || legacyCli
	const remote = isRemoteSession(process.env, process.platform)

	if (!interactive)
		return plainLogin(args, label)

	const child = spawn('aws', args, { stdio:['ignore', 'pipe', 'pipe'], ...(IS_WINDOWS ? { shell:true } : {}) })
	let output = ''
	let shown = false
	let rawMode = false
	let spin = null
	let parsed = {}

	const stdin = process.stdin
	const onKey = async key => {
		if (key === '\u0003') { // Ctrl+C
			child.kill()
			return
		}
		if (!parsed.code)
			return
		if (key == 'q' || key == 'Q') {
			spin.clear()
			p.log.message(renderUnicodeCompact(parsed.completeUrl || parsed.url, { border:1 }) + '\n' + ui.dim('Scan with your phone to approve.'))
			spin.start()
		} else if (key == 'c' || key == 'C') {
			const r = await clipboard.copy(parsed.code)
			spin.message(`Waiting for approval ${clipboardNote(r)}`)
		} else if ((key == 'o' || key == '\r') && !remote)
			await clipboard.openUrl(parsed.completeUrl || parsed.url)
	}
	const cleanup = () => {
		if (rawMode) {
			stdin.setRawMode(false)
			stdin.removeListener('data', onKey)
			stdin.pause()
			rawMode = false
		}
	}

	const show = async () => {
		shown = true
		if (device && parsed.code) {
			const copied = await clipboard.copy(parsed.code)
			const opened = !remote && await clipboard.openUrl(parsed.completeUrl || parsed.url)
			p.log.step([
				`Approve the login for ${ui.accent(label)}`,
				'',
				`${ui.dim('Open')}  ${parsed.completeUrl || parsed.url}`,
				`${ui.dim('Code')}  ${ui.code(parsed.code)}  ${clipboardNote(copied)}`,
				'',
				`${ui.unicode ? '🔒 ' : ''}Only approve if the page shows exactly this code.`,
				ui.dim([remote || !opened ? null : 'opened in your browser', 'q QR code', 'c copy again', !remote ? 'o open browser' : null, 'ctrl+c cancel'].filter(Boolean).join(' · '))
			].join('\n'))
			if (stdin.isTTY) {
				stdin.setRawMode(true)
				stdin.resume()
				stdin.setEncoding('utf8')
				stdin.on('data', onKey)
				rawMode = true
			}
		} else
			p.log.step(`Opening your browser to log in to ${ui.accent(label)}…\n${ui.dim(`If nothing opens, visit: ${parsed.url}`)}`)
		spin = ui.timerSpinner()
		spin.start('Waiting for approval')
	}

	const onData = async chunk => {
		output += chunk
		if (shown)
			return
		parsed = parseLoginOutput(output)
		const ready = device ? (parsed.code && (parsed.completeUrl || legacyCli)) : parsed.url
		if (ready)
			await show()
	}
	child.stdout.on('data', d => onData(d.toString()))
	child.stderr.on('data', d => { output += d.toString() })

	// If the AWS CLI prints something we can't parse, show it as-is rather than leaving the user waiting.
	const fallback = setTimeout(() => {
		if (!shown && output.trim()) {
			shown = true
			p.log.message(output.trim())
			spin = ui.timerSpinner()
			spin.start('Waiting for the login to complete')
		}
	}, RAW_OUTPUT_AFTER_MS)

	const code = await new Promise(resolve => {
		child.on('error', () => resolve(-1))
		child.on('close', resolve)
	})
	clearTimeout(fallback)
	cleanup()

	if (code === 0) {
		if (spin)
			spin.stop(`${ui.unicode ? '🔓 ' : ''}Logged in`)
		else
			p.log.success('Logged in')
		await rememberLogin(loginKey)
		return
	}

	if (child.killed) {
		if (spin)
			spin.clear()
		throw new CancelError('Login cancelled')
	}
	if (spin)
		spin.error('Login did not complete')
	const lines = output.trim().split('\n').map(l => l.trim()).filter(Boolean)
	const detail = (lines.filter(l => /error|exception|denied|invalid|expired|unable/i.test(l)).slice(-2).join('\n')) || lines.slice(-1)[0] || ''
	throw new ui.CliError(`SSO login for ${label} failed.${detail ? `\n${detail}` : ''}`, {
		hint: /invalid_grant|InvalidGrant/i.test(output) ? 'Check the SSO region of this profile: it must be the region of your IAM Identity Center, not where your resources live.' : 'Try again, or run with --debug.'
	})
}

/**
 * Non-interactive login: no keypresses or spinner, AWS CLI output passed through on stderr.
 */
const plainLogin = async (args, label) => {
	console.error(`Logging in to ${label}. Approve the request using the URL and code below.`)
	await new Promise((resolve, reject) => {
		const child = spawn('aws', args, { stdio:['ignore', process.stderr, process.stderr], ...(IS_WINDOWS ? { shell:true } : {}) })
		child.on('error', reject)
		child.on('close', code => code === 0 ? resolve() : reject(new ui.CliError(`SSO login for ${label} failed.`, { code:2 })))
	})
}

const rememberLogin = async key => {
	if (!key)
		return
	const current = await settings.read()
	await settings.update({ logins: { ...(current.logins || {}), [key]: new Date().toISOString() } })
}

module.exports = {
	ssoLogin,
	rememberLogin
}

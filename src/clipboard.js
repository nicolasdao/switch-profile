/**
 * Copies text to the clipboard of the person at the keyboard.
 *
 * On a local machine this uses the OS clipboard tool. Over SSH, the remote machine's clipboard is useless,
 * so the text is sent with the OSC 52 terminal escape sequence, which terminals such as iTerm2, Ghostty,
 * kitty, WezTerm, Windows Terminal and tmux (with set-clipboard on) forward to the local clipboard.
 */
const { spawn } = require('child_process')
const { isRemoteSession } = require('./aws/login')

const LOCAL_TOOLS = {
	darwin: [['pbcopy', []]],
	win32: [['clip', []]],
	linux: [['wl-copy', []], ['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]]
}

const pipeTo = (cmd, args, text) => new Promise(resolve => {
	try {
		const child = spawn(cmd, args, { stdio:['pipe', 'ignore', 'ignore'], ...(process.platform == 'win32' ? { shell:true } : {}) })
		child.on('error', () => resolve(false))
		child.on('close', code => resolve(code === 0))
		child.stdin.end(text)
	} catch {
		resolve(false)
	}
})

/**
 * Pure: the OSC 52 sequence(s) for a text. Inside tmux, a passthrough-wrapped copy is added for setups
 * where tmux does not handle OSC 52 itself.
 */
const osc52 = (text, env) => {
	const seq = `\x1b]52;c;${Buffer.from(text).toString('base64')}\x07`
	if (env && env.TMUX)
		return seq + `\x1bPtmux;${seq.split('\x1b').join('\x1b\x1b')}\x1b\\`
	return seq
}

/**
 * @return {String} 'local' (copied for sure), 'terminal' (sent via OSC 52, depends on the terminal) or null
 */
const copy = async text => {
	const env = process.env
	if (isRemoteSession(env, process.platform)) {
		if (!process.stdout.isTTY)
			return null
		process.stdout.write(osc52(text, env))
		return 'terminal'
	}
	for (const [cmd, args] of LOCAL_TOOLS[process.platform] || []) {
		if (await pipeTo(cmd, args, text))
			return 'local'
	}
	return null
}

/**
 * Opens a URL in the local browser. Resolves false when it could not (e.g., over SSH).
 */
const openUrl = url => new Promise(resolve => {
	if (isRemoteSession(process.env, process.platform))
		return resolve(false)
	const [cmd, args] = process.platform == 'darwin' ? ['open', [url]]
		: process.platform == 'win32' ? ['cmd', ['/c', 'start', '""', `"${url}"`]]
			: ['xdg-open', [url]]
	try {
		const child = spawn(cmd, args, { stdio:'ignore', detached:true, ...(process.platform == 'win32' ? { shell:true, windowsVerbatimArguments:true } : {}) })
		child.on('error', () => resolve(false))
		child.on('spawn', () => { child.unref(); resolve(true) })
	} catch {
		resolve(false)
	}
})

module.exports = {
	osc52,
	copy,
	openUrl
}

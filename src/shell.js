/**
 * Per-terminal switching.
 *
 * A child process (this CLI) cannot change the environment of the shell that launched it. So per-terminal
 * switching relies on a small shell function, 'sp', that switch-profile adds to the user's shell startup
 * file inside a managed block. The function:
 * 	1. Runs switch-profile with SWITCH_PROFILE_SHELL=<shell> and SWITCH_PROFILE_ENV_FILE=<temp file>.
 * 	2. switch-profile writes the selected profile name into that temp file (and nothing else).
 * 	3. The function reads the file and sets AWS_PROFILE in the current shell.
 *
 * SWITCH_PROFILE_SHELL is also how switch-profile knows it was launched through the function.
 */
const fs = require('fs')
const { homedir } = require('os')
const { join, dirname, basename } = require('path')
const { run } = require('./core')

const IS_WINDOWS = process.platform === 'win32'
const IS_MAC = process.platform === 'darwin'
const FUNCTION_NAME = 'sp'
const BLOCK_START_PREFIX = '# >>> switch-profile'
const BLOCK_END = '# <<< switch-profile <<<'
const BLOCK_REGEX = /(^|\r?\n)# >>> switch-profile[^\n]*\r?\n[\s\S]*?# <<< switch-profile <<<[^\n]*(\r?\n)?/

const blockStart = version => `${BLOCK_START_PREFIX} v${version} (managed by switch-profile, do not edit) >>>`

const POSIX_FUNCTION = shell => `${FUNCTION_NAME}() {
	local __sp_file __sp_status
	__sp_file="$(mktemp "\${TMPDIR:-/tmp}/switch-profile.XXXXXX")" || return 1
	if command -v switch-profile >/dev/null 2>&1; then
		SWITCH_PROFILE_SHELL=${shell} SWITCH_PROFILE_ENV_FILE="$__sp_file" switch-profile "$@"
	else
		SWITCH_PROFILE_SHELL=${shell} SWITCH_PROFILE_ENV_FILE="$__sp_file" npx --yes switch-profile "$@"
	fi
	__sp_status=$?
	if [ -s "$__sp_file" ]; then
		export AWS_PROFILE="$(cat "$__sp_file")"
	fi
	rm -f "$__sp_file"
	return $__sp_status
}`

const FISH_FUNCTION = `function ${FUNCTION_NAME}
	set -l __sp_file (mktemp)
	if type -q switch-profile
		env SWITCH_PROFILE_SHELL=fish SWITCH_PROFILE_ENV_FILE=$__sp_file switch-profile $argv
	else
		env SWITCH_PROFILE_SHELL=fish SWITCH_PROFILE_ENV_FILE=$__sp_file npx --yes switch-profile $argv
	end
	set -l __sp_status $status
	if test -s $__sp_file
		set -gx AWS_PROFILE (cat $__sp_file)
	end
	rm -f $__sp_file
	return $__sp_status
end`

const POWERSHELL_FUNCTION = `function ${FUNCTION_NAME} {
	$spFile = [System.IO.Path]::GetTempFileName()
	$env:SWITCH_PROFILE_SHELL = 'powershell'
	$env:SWITCH_PROFILE_ENV_FILE = $spFile
	try {
		if (Get-Command switch-profile -ErrorAction SilentlyContinue) { switch-profile @args } else { npx --yes switch-profile @args }
	} finally {
		Remove-Item Env:\\SWITCH_PROFILE_SHELL -ErrorAction SilentlyContinue
		Remove-Item Env:\\SWITCH_PROFILE_ENV_FILE -ErrorAction SilentlyContinue
	}
	$spProfile = Get-Content -Raw $spFile -ErrorAction SilentlyContinue
	if ($spProfile) { $env:AWS_PROFILE = $spProfile.Trim() }
	Remove-Item $spFile -ErrorAction SilentlyContinue
}`

const functionFor = shell => shell == 'fish' ? FISH_FUNCTION : shell == 'powershell' ? POWERSHELL_FUNCTION : POSIX_FUNCTION(shell)

/**
 * The full managed block for a shell, markers included.
 */
const buildBlock = (shell, version) => [blockStart(version), functionFor(shell), BLOCK_END].join('\n')

const blockBody = block => (block || '').replace(/\r\n/g, '\n').split('\n').slice(1).join('\n').trim()

/**
 * Pure: returns the managed block found in a startup file's content, or null.
 */
const findBlock = content => {
	const m = (content || '').match(BLOCK_REGEX)
	if (!m)
		return null
	const block = m[0].replace(/^\r?\n/, '').replace(/\r?\n$/, '')
	const version = (block.match(/^# >>> switch-profile v(\S+)/)||[])[1] || null
	return { block, version }
}

/**
 * Pure: adds (or replaces) the managed block.
 */
const addBlock = (content, block) => {
	content = content || ''
	if (findBlock(content))
		return content.replace(BLOCK_REGEX, (match, lead) => `${lead}${block}\n`)
	const trimmed = content.replace(/\s+$/, '')
	return (trimmed ? `${trimmed}\n\n` : '') + block + '\n'
}

/**
 * Pure: removes the managed block, if any.
 */
const removeBlock = content => {
	content = content || ''
	if (!findBlock(content))
		return content
	const result = content.replace(BLOCK_REGEX, (match, lead) => lead ? '\n' : '').replace(/\n{3,}/g, '\n\n')
	return result.trim() ? result.replace(/\s+$/, '') + '\n' : ''
}

/**
 * Detects the user's shell and the startup file(s) the function belongs in.
 *
 * @return {String} shell.name		'zsh' | 'bash' | 'fish' | 'powershell' | null (unsupported)
 * @return {Array}  shell.files		Absolute startup file paths
 * @return {String} shell.label		Human friendly description (e.g., 'zsh (~/.zshrc)')
 * @return {String} shell.reload	Command that loads the function in the current terminal
 */
let _detected = null
const detectShell = async () => {
	if (!_detected)
		_detected = _detectShell()
	return _detected
}

const _detectShell = async () => {
	const home = homedir()
	const shellPath = process.env.SHELL || ''
	const name = basename(shellPath).replace(/\.exe$/, '')

	if (name == 'zsh') {
		const file = join(process.env.ZDOTDIR || home, '.zshrc')
		return { name, files:[file], reload:`source ${tilde(file)}` }
	}
	if (name == 'bash') {
		const file = join(home, IS_MAC ? '.bash_profile' : '.bashrc')
		return { name, files:[file], reload:`source ${tilde(file)}` }
	}
	if (name == 'fish') {
		const file = join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'fish', 'config.fish')
		return { name, files:[file], reload:`source ${tilde(file)}` }
	}
	if (IS_WINDOWS && !shellPath) {
		const files = []
		for (const exe of ['pwsh', 'powershell']) {
			const file = await run(exe, ['-NoProfile', '-NonInteractive', '-Command', '$PROFILE.CurrentUserAllHosts'])
				.then(out => (out||'').trim()).catch(() => '')
			if (file && !files.includes(file))
				files.push(file)
		}
		if (files.length)
			return { name:'powershell', files, reload:'. $PROFILE.CurrentUserAllHosts' }
	}
	return { name:null, files:[], reload:null }
}

const tilde = file => file.startsWith(homedir()) ? '~' + file.slice(homedir().length) : file

const readFile = file => fs.promises.readFile(file, 'utf8').catch(err => {
	if (err.code == 'ENOENT')
		return ''
	throw err
})

/**
 * @return {Boolean} status.supported		False when the shell is not supported.
 * @return {Boolean} status.installed		The managed block exists in at least one startup file.
 * @return {Boolean} status.active			This process was launched through the function.
 * @return {Boolean} status.outdated		The installed block differs from the one this version would write.
 * @return {String}  status.installedVersion
 * @return {Object}  status.shell			See detectShell
 */
const getStatus = async version => {
	const shell = await detectShell()
	const active = !!process.env.SWITCH_PROFILE_SHELL
	if (!shell.name)
		return { supported:false, installed:false, active, outdated:false, installedVersion:null, shell }

	const found = []
	for (const file of shell.files) {
		const b = findBlock(await readFile(file))
		if (b)
			found.push(b)
	}
	const expected = blockBody(buildBlock(shell.name, version))
	return {
		supported: true,
		installed: found.length > 0,
		active,
		outdated: found.some(b => blockBody(b.block) != expected),
		installedVersion: found.length ? found[0].version : null,
		shell
	}
}

const install = async version => {
	const shell = await detectShell()
	if (!shell.name)
		throw new Error('Your shell is not supported for per-terminal switching. Supported shells: zsh, bash, fish and PowerShell.')
	const block = buildBlock(shell.name, version)
	for (const file of shell.files) {
		await fs.promises.mkdir(dirname(file), { recursive:true })
		await fs.promises.writeFile(file, addBlock(await readFile(file), block))
	}
	return shell
}

const uninstall = async () => {
	const shell = await detectShell()
	for (const file of shell.files) {
		const content = await readFile(file)
		if (findBlock(content))
			await fs.promises.writeFile(file, removeBlock(content))
	}
	return shell
}

/**
 * Hands the selected profile to the 'sp' function. Only does something when launched through it.
 *
 * @return {Boolean} True if the profile was handed over.
 */
const exportProfile = async profile => {
	const file = process.env.SWITCH_PROFILE_ENV_FILE
	if (!process.env.SWITCH_PROFILE_SHELL || !file || !profile)
		return false
	await fs.promises.writeFile(file, profile)
	return true
}

module.exports = {
	FUNCTION_NAME,
	BLOCK_END,
	buildBlock,
	findBlock,
	addBlock,
	removeBlock,
	detectShell,
	getStatus,
	install,
	uninstall,
	exportProfile,
	tilde
}

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

// Credentials in the environment take precedence over AWS_PROFILE (CLI, boto3) or are ignored by it
// (JS SDK), and boto3 reads AWS_DEFAULT_PROFILE first. Switching clears them so every tool agrees.
const CLEARED_VARS = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_DEFAULT_PROFILE']
const SUBCOMMANDS = ['status', 'login', 'logout', 'add', 'remove', 'settings', 'use']
const PROFILES_SED = 'sed -n \'s/^\\[profile \\(.*\\)\\]$/\\1/p\''

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
		unset ${CLEARED_VARS.join(' ')}
	fi
	rm -f "$__sp_file"
	return $__sp_status
}`

const ZSH_COMPLETION = `_switch_profile_complete() {
	local -a items
	items=(\${(f)"$(${PROFILES_SED} "\${AWS_CONFIG_FILE:-$HOME/.aws/config}" 2>/dev/null)"})
	if (( CURRENT == 2 )); then
		compadd -- $items ${SUBCOMMANDS.join(' ')}
	elif [[ $words[2] == (remove|rm) ]] || { (( CURRENT == 3 )) && [[ $words[2] == (use|login) ]] }; then
		compadd -- $items
	fi
}
if (( $+functions[compdef] )); then
	compdef _switch_profile_complete ${FUNCTION_NAME} switch-profile
fi`

const BASH_COMPLETION = `_switch_profile_complete() {
	local cur="\${COMP_WORDS[COMP_CWORD]}" items
	items="$(${PROFILES_SED} "\${AWS_CONFIG_FILE:-$HOME/.aws/config}" 2>/dev/null)"
	if [ "$COMP_CWORD" -eq 1 ]; then
		items="$items ${SUBCOMMANDS.join(' ')}"
	elif [ "$COMP_CWORD" -lt 2 ] || ! case "\${COMP_WORDS[1]}" in use|login|remove|rm) true ;; *) false ;; esac; then
		return 0
	elif [ "$COMP_CWORD" -gt 2 ] && [ "\${COMP_WORDS[1]}" != remove ] && [ "\${COMP_WORDS[1]}" != rm ]; then
		return 0
	fi
	COMPREPLY=($(compgen -W "$items" -- "$cur"))
}
complete -F _switch_profile_complete ${FUNCTION_NAME} switch-profile`

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
		set -e ${CLEARED_VARS.join(' ')}
	end
	rm -f $__sp_file
	return $__sp_status
end
function __switch_profile_profiles
	set -l cfg ~/.aws/config
	set -q AWS_CONFIG_FILE; and set cfg $AWS_CONFIG_FILE
	${PROFILES_SED} $cfg 2>/dev/null
end
for __sp_cmd in ${FUNCTION_NAME} switch-profile
	complete -c $__sp_cmd -f -n 'test (count (commandline -opc)) -eq 1' -a '(__switch_profile_profiles) ${SUBCOMMANDS.join(' ')}'
	complete -c $__sp_cmd -f -n 'test (count (commandline -opc)) -eq 2; and __fish_seen_subcommand_from use login' -a '(__switch_profile_profiles)'
	complete -c $__sp_cmd -f -n '__fish_seen_subcommand_from remove rm' -a '(__switch_profile_profiles)'
end`

const POWERSHELL_FUNCTION = `function ${FUNCTION_NAME} {
	param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Rest)
	$spFile = [System.IO.Path]::GetTempFileName()
	$env:SWITCH_PROFILE_SHELL = 'powershell'
	$env:SWITCH_PROFILE_ENV_FILE = $spFile
	try {
		if (Get-Command switch-profile -ErrorAction SilentlyContinue) { switch-profile @Rest } else { npx --yes switch-profile @Rest }
	} finally {
		Remove-Item Env:\\SWITCH_PROFILE_SHELL -ErrorAction SilentlyContinue
		Remove-Item Env:\\SWITCH_PROFILE_ENV_FILE -ErrorAction SilentlyContinue
	}
	$spProfile = Get-Content -Raw $spFile -ErrorAction SilentlyContinue
	if ($spProfile) {
		$env:AWS_PROFILE = $spProfile.Trim()
		${CLEARED_VARS.map(v => `Remove-Item Env:\\${v} -ErrorAction SilentlyContinue`).join('\n\t\t')}
	}
	Remove-Item $spFile -ErrorAction SilentlyContinue
}
$__spComplete = {
	param($commandName, $parameterName, $wordToComplete)
	$cfg = if ($env:AWS_CONFIG_FILE) { $env:AWS_CONFIG_FILE } else { Join-Path $HOME '.aws/config' }
	$items = @(${SUBCOMMANDS.map(c => `'${c}'`).join(', ')})
	if (Test-Path $cfg) { $items += Select-String -Path $cfg -Pattern '^\\[profile (.+)\\]' | ForEach-Object { $_.Matches[0].Groups[1].Value.Trim() } }
	$items | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}
Register-ArgumentCompleter -CommandName ${FUNCTION_NAME} -ParameterName Rest -ScriptBlock $__spComplete`

const functionFor = shell => shell == 'fish' ? FISH_FUNCTION
	: shell == 'powershell' ? POWERSHELL_FUNCTION
		: [POSIX_FUNCTION(shell), shell == 'zsh' ? ZSH_COMPLETION : BASH_COMPLETION].join('\n')

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
	CLEARED_VARS,
	SUBCOMMANDS,
	functionFor,
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

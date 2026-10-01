const { assert } = require('chai')
const fs = require('fs')
const os = require('os')
const { join } = require('path')
const { execFileSync } = require('child_process')
const shell = require('../src/shell')

const hasShell = name => { try { execFileSync('which', [name], { stdio:'ignore' }); return true } catch { return false } }

describe('shell', () => {
	it('Should add, detect, update and remove the managed block', () => {
		const rc = 'export PATH=/x:$PATH\nalias ll="ls -l"\n'
		const added = shell.addBlock(rc, shell.buildBlock('zsh', '2.0.0'))
		assert.include(added, 'alias ll="ls -l"\n\n# >>> switch-profile v2.0.0')
		assert.equal(shell.findBlock(added).version, '2.0.0')

		const updated = shell.addBlock(added, shell.buildBlock('zsh', '2.1.0'))
		assert.equal(updated.match(/# >>> switch-profile/g).length, 1)
		assert.equal(shell.findBlock(updated).version, '2.1.0')

		assert.equal(shell.removeBlock(updated), rc)
		assert.isNull(shell.findBlock(rc))
		assert.equal(shell.removeBlock(shell.addBlock('', shell.buildBlock('bash', '2.0.0'))), '')
	})

	it('Should keep content written after the block', () => {
		const withBlock = shell.addBlock('a=1\n', shell.buildBlock('zsh', '2.0.0')) + '\nb=2\n'
		assert.equal(shell.removeBlock(withBlock), 'a=1\n\nb=2\n')
	})

	const fakeConfig = dir => {
		fs.mkdirSync(join(dir, '.aws'), { recursive:true })
		fs.writeFileSync(join(dir, '.aws', 'config'), '[default]\nregion = x\n\n[profile acme-prod]\nregion = x\n\n[profile acme-dev]\nregion = x\n\n[sso-session acme]\nsso_region = x\n')
	}

	;(hasShell('bash') ? it : xit)('Should complete profile names and subcommands in bash', () => {
		const dir = fs.mkdtempSync(join(os.tmpdir(), 'sp-test-'))
		fakeConfig(dir)
		fs.writeFileSync(join(dir, 'rc'), shell.buildBlock('bash', '2.0.0') + '\n')
		const complete = words => execFileSync('bash', ['-c', `. "${join(dir, 'rc')}"; COMP_WORDS=(${words}); COMP_CWORD=$((\${#COMP_WORDS[@]}-1)); _switch_profile_complete; echo "\${COMPREPLY[*]}"`], { env:{ PATH:'/usr/bin:/bin', HOME:dir } }).toString().trim()
		assert.equal(complete('sp acme'), 'acme-prod acme-dev')
		assert.equal(complete('sp st'), 'status')
		assert.equal(complete('sp login acme-p'), 'acme-prod')
		assert.equal(complete('sp status x'), '')
		assert.equal(complete('sp remove acme-prod acme-d'), 'acme-dev')
		assert.equal(complete('sp use acme-prod acme-d'), '')
	}).timeout(15000)

	;(hasShell('zsh') ? it : xit)('Should register zsh completion when compinit is loaded', () => {
		const dir = fs.mkdtempSync(join(os.tmpdir(), 'sp-test-'))
		fs.writeFileSync(join(dir, 'rc'), shell.buildBlock('zsh', '2.0.0') + '\n')
		const out = execFileSync('zsh', ['-f', '-c', `autoload -Uz compinit && compinit -u -d "${join(dir, 'zcomp')}"; . "${join(dir, 'rc')}"; echo "$_comps[sp] $_comps[switch-profile]"`], { env:{ PATH:'/usr/bin:/bin', HOME:dir } }).toString().trim()
		assert.equal(out, '_switch_profile_complete _switch_profile_complete')
		// Without compinit, loading the block must not fail.
		execFileSync('zsh', ['-f', '-c', `. "${join(dir, 'rc')}"`], { env:{ PATH:'/usr/bin:/bin', HOME:dir } })
	}).timeout(15000)

	;(hasShell('bash') ? it : xit)('Should run SWITCH_PROFILE_DEV_BIN instead of npx when set', () => {
		const dir = fs.mkdtempSync(join(os.tmpdir(), 'sp-test-'))
		fs.writeFileSync(join(dir, 'local-build'), '#!/bin/sh\nprintf "from-dev-bin" > "$SWITCH_PROFILE_ENV_FILE"\n', { mode:0o755 })
		fs.writeFileSync(join(dir, 'rc'), shell.buildBlock('bash', '2.0.0') + '\n')
		const out = execFileSync('bash', ['-c', `. "${join(dir, 'rc')}"; sp; echo "profile=$AWS_PROFILE"`], {
			env: { PATH:'/usr/bin:/bin', TMPDIR:dir, HOME:dir, SWITCH_PROFILE_DEV_BIN:join(dir, 'local-build') }
		}).toString()
		assert.include(out, 'profile=from-dev-bin')
	}).timeout(15000)

	for (const sh of ['zsh', 'bash']) {
		(hasShell(sh) ? it : xit)(`Should set AWS_PROFILE in the calling ${sh} shell`, () => {
			const dir = fs.mkdtempSync(join(os.tmpdir(), 'sp-test-'))
			// Fake npx: checks the function asks for the latest release, was launched through the function,
			// and hands over a profile.
			fs.writeFileSync(join(dir, 'npx'), '#!/bin/sh\n[ "$1 $2" = "--yes switch-profile@latest" ] || exit 4\n[ "$SWITCH_PROFILE_SHELL" = "' + sh + '" ] || exit 3\nprintf "client-a" > "$SWITCH_PROFILE_ENV_FILE"\n', { mode:0o755 })
			// A global switch-profile must be ignored: npx always wins.
			fs.writeFileSync(join(dir, 'switch-profile'), '#!/bin/sh\nexit 5\n', { mode:0o755 })
			fs.writeFileSync(join(dir, 'rc'), shell.buildBlock(sh, '2.0.0') + '\n')
			const out = execFileSync(sh, ['-c', `. "${join(dir, 'rc')}"; sp; echo "profile=$AWS_PROFILE key=\${AWS_ACCESS_KEY_ID:-none} default=\${AWS_DEFAULT_PROFILE:-none}"`], {
				env: { PATH:`${dir}:/usr/bin:/bin`, TMPDIR:dir, HOME:dir, AWS_ACCESS_KEY_ID:'AKIASTALE', AWS_DEFAULT_PROFILE:'old' }
			}).toString()
			assert.include(out, 'profile=client-a key=none default=none')
			assert.deepEqual(fs.readdirSync(dir).filter(f => f.startsWith('switch-profile.')), [], 'temp file must be removed')
		}).timeout(15000)
	}
})

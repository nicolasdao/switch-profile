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

	for (const sh of ['zsh', 'bash']) {
		(hasShell(sh) ? it : xit)(`Should set AWS_PROFILE in the calling ${sh} shell`, () => {
			const dir = fs.mkdtempSync(join(os.tmpdir(), 'sp-test-'))
			// Fake switch-profile: checks it was launched through the function and hands over a profile.
			fs.writeFileSync(join(dir, 'switch-profile'), '#!/bin/sh\n[ "$SWITCH_PROFILE_SHELL" = "' + sh + '" ] || exit 3\nprintf "client-a" > "$SWITCH_PROFILE_ENV_FILE"\n', { mode:0o755 })
			fs.writeFileSync(join(dir, 'rc'), shell.buildBlock(sh, '2.0.0') + '\n')
			const out = execFileSync(sh, ['-c', `. "${join(dir, 'rc')}"; sp; echo "profile=$AWS_PROFILE"`], {
				env: { PATH:`${dir}:/usr/bin:/bin`, TMPDIR:dir, HOME:dir }
			}).toString()
			assert.include(out, 'profile=client-a')
			assert.deepEqual(fs.readdirSync(dir).filter(f => f.startsWith('switch-profile.')), [], 'temp file must be removed')
		}).timeout(15000)
	}
})

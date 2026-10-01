const { assert } = require('chai')
const ini = require('../src/ini')

const SAMPLE = `# my comment
[default]
region = us-east-1

[profile dev]
region = ap-southeast-2 ; trailing
output = json

[sso-session acme]
sso_start_url = https://acme.awsapps.com/start
`

describe('ini', () => {
	it('Should list sections and read entries', () => {
		assert.deepEqual(ini.listSections(SAMPLE), ['default', 'profile dev', 'sso-session acme'])
		assert.equal(ini.getSection(SAMPLE, 'sso-session acme').sso_start_url, 'https://acme.awsapps.com/start')
		assert.isNull(ini.getSection(SAMPLE, 'profile nope'))
	})
	it('Should replace a section and keep everything else', () => {
		const out = ini.setSection(SAMPLE, 'default', [['region', 'eu-west-1']])
		assert.include(out, '# my comment')
		assert.include(out, '[default]\nregion = eu-west-1\n')
		assert.include(out, '[profile dev]\nregion = ap-southeast-2 ; trailing')
	})
	it('Should create a section at the top or the end', () => {
		assert.match(ini.setSection('[profile a]\nx = 1\n', 'default', [['y', '2']], { position:'top' }), /^\[default\]\ny = 2\n\n\[profile a\]/)
		assert.match(ini.setSection('[profile a]\nx = 1\n', 'b', [['y', '2']]), /x = 1\n\n\[b\]\ny = 2\n$/)
		assert.equal(ini.setSection('', 'default', [['y', '2']]), '[default]\ny = 2\n')
	})
	it('Should remove a section', () => {
		const out = ini.removeSection(SAMPLE, 'profile dev')
		assert.notInclude(out, 'profile dev')
		assert.notInclude(out, 'ap-southeast-2')
		assert.include(out, '[sso-session acme]')
	})
	it('Should set and delete keys in place', () => {
		const out = ini.setKeys(SAMPLE, 'profile dev', { output:null, sso_session:'acme', region:'us-west-2' })
		assert.include(out, '[profile dev]\nregion = us-west-2\nsso_session = acme\n\n[sso-session acme]')
		assert.equal(ini.setKeys(SAMPLE, 'nope', { a:1 }), SAMPLE)
	})
	it('Should preserve CRLF line endings', () => {
		const out = ini.setKeys('[default]\r\na = 1\r\n', 'default', { b:'2' })
		assert.equal(out, '[default]\r\na = 1\r\nb = 2\r\n')
	})
})

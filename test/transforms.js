const { assert } = require('chai')
const ini = require('../src/ini')
const t = require('../src/aws/transforms')

const LEGACY_CONFIG = `[default]
region = us-east-1
output = json

[profile dev]
sso_start_url = https://acme.awsapps.com/start
sso_region = us-east-1
sso_account_id = 111111111111
sso_role_name = Admin
region = ap-southeast-2

[profile prod]
sso_start_url = https://acme.awsapps.com/start/
sso_region = us-east-1
sso_account_id = 222222222222
sso_role_name = ReadOnly
region = ap-southeast-2

[profile other]
sso_start_url = https://beta.awsapps.com/start
sso_region = eu-west-1
sso_account_id = 333333333333
sso_role_name = Admin

[profile keys]
region = us-west-2
`
const LEGACY_CREDS = `[default]
aws_access_key_id = ASIATEMP
aws_secret_access_key = secret
aws_session_token = token
expiry_date = 2021-07-17T11:33:12.000Z
profile = dev

[keys]
aws_access_key_id = AKIASTATIC
aws_secret_access_key = static-secret
`

describe('transforms', () => {
	it('Should detect a switch-profile 1.x default', () => {
		assert.isTrue(t.hasLegacyDefault(LEGACY_CREDS))
		assert.equal(t.getDefaultProfileName(LEGACY_CONFIG, LEGACY_CREDS), 'dev')
		assert.isFalse(t.hasLegacyDefault('[default]\naws_access_key_id = a\n'))
	})

	it('Should write settings, not credentials, into [default] for an SSO profile', () => {
		const { config, creds } = t.setDefaultProfile(LEGACY_CONFIG, LEGACY_CREDS, 'dev', '2.0.0')
		assert.deepEqual(ini.getSection(config, 'default'), {
			sso_start_url: 'https://acme.awsapps.com/start',
			sso_region: 'us-east-1',
			sso_account_id: '111111111111',
			sso_role_name: 'Admin',
			region: 'ap-southeast-2',
			switch_profile_name: 'dev',
			switch_profile_version: '2.0.0'
		})
		assert.isNull(ini.getSection(creds, 'default'), 'temporary keys must be removed')
		assert.include(creds, '[keys]')
		assert.equal(t.getDefaultProfileName(config, creds), 'dev')
	})

	it('Should mirror static credentials into [default] for a standard profile', () => {
		const { config, creds } = t.setDefaultProfile(LEGACY_CONFIG, LEGACY_CREDS, 'keys', '2.0.0')
		assert.equal(ini.getSection(config, 'default').region, 'us-west-2')
		assert.deepEqual(ini.getSection(creds, 'default'), {
			aws_access_key_id: 'AKIASTATIC',
			aws_secret_access_key: 'static-secret',
			switch_profile_version: '2.0.0'
		})
	})

	it('Should not carry stamps over when switching twice', () => {
		const first = t.setDefaultProfile(LEGACY_CONFIG, LEGACY_CREDS, 'dev', '2.0.0')
		const second = t.setDefaultProfile(first.config, first.creds, 'prod', '2.0.1')
		const d = ini.getEntries(second.config, 'default')
		assert.equal(d.filter(([k]) => k == 'switch_profile_name').length, 1)
		assert.equal(ini.getSection(second.config, 'default').switch_profile_version, '2.0.1')
		assert.equal(ini.getSection(second.config, 'default').sso_account_id, '222222222222')
	})

	it('Should throw for an unknown profile', () => {
		assert.throws(() => t.setDefaultProfile(LEGACY_CONFIG, LEGACY_CREDS, 'nope', '2.0.0'))
	})

	it('Should remove an orphaned 1.x [default] holding temporary keys', () => {
		const out = t.stripLegacyDefault(LEGACY_CREDS)
		assert.isNull(ini.getSection(out, 'default'))
		assert.include(out, '[keys]')
	})

	it('Should keep static keys of an orphaned 1.x [default], minus the custom keys', () => {
		const out = t.stripLegacyDefault('[default]\naws_access_key_id = AKIA\naws_secret_access_key = s\nprofile = gone\n')
		assert.deepEqual(ini.getSection(out, 'default'), { aws_access_key_id:'AKIA', aws_secret_access_key:'s' })
	})

	it('Should find legacy SSO profiles', () => {
		assert.deepEqual(t.findLegacySsoProfiles(LEGACY_CONFIG), ['dev', 'prod', 'other'])
	})

	it('Should upgrade legacy SSO profiles, one session per portal', () => {
		const { config, sessions } = t.upgradeLegacySsoProfiles(LEGACY_CONFIG, ['dev', 'prod', 'other'], '2.0.0')
		assert.deepEqual(sessions.map(s => [s.name, s.profiles]), [['acme', ['dev', 'prod']], ['beta', ['other']]])
		assert.deepEqual(ini.getSection(config, 'sso-session acme'), {
			sso_start_url: 'https://acme.awsapps.com/start',
			sso_region: 'us-east-1',
			sso_registration_scopes: 'sso:account:access',
			switch_profile_version: '2.0.0'
		})
		const dev = ini.getSection(config, 'profile dev')
		assert.equal(dev.sso_session, 'acme')
		assert.notProperty(dev, 'sso_start_url')
		assert.notProperty(dev, 'sso_region')
		assert.equal(dev.region, 'ap-southeast-2')
		assert.deepEqual(t.findLegacySsoProfiles(config), [])
		const profiles = t.listProfiles(config)
		assert.isTrue(profiles.find(p => p.name == 'dev').isSso)
		assert.isFalse(profiles.find(p => p.name == 'dev').isLegacySso)
		assert.equal(profiles.find(p => p.name == 'other').sso_start_url, 'https://beta.awsapps.com/start')
	})

	it('Should reuse an existing matching sso-session and avoid name clashes', () => {
		const withSessions = LEGACY_CONFIG + `
[sso-session corp]
sso_start_url = https://acme.awsapps.com/start
sso_region = us-east-1

[sso-session beta]
sso_start_url = https://somewhere-else.example.com/start
sso_region = eu-west-1
`
		const { config, sessions } = t.upgradeLegacySsoProfiles(withSessions, ['dev', 'other'], '2.0.0')
		assert.deepEqual(sessions.map(s => [s.name, s.created]), [['corp', false], ['beta-2', true]])
		assert.equal(ini.getSection(config, 'profile other').sso_session, 'beta-2')
		assert.equal(ini.getSection(config, 'sso-session beta').sso_start_url, 'https://somewhere-else.example.com/start')
	})

	it('Should derive session names from start URLs', () => {
		assert.equal(t.sessionNameFromUrl('https://acme.awsapps.com/start'), 'acme')
		assert.equal(t.sessionNameFromUrl('https://identitycenter.amazonaws.com/ssoins-72236a1b2c3d'), 'ssoins-72236a1b2c3d')
		assert.equal(t.sessionNameFromUrl('not a url'), 'sso')
	})

	it('Should not list [default] or [sso-session] as profiles', () => {
		assert.deepEqual(t.listProfiles(LEGACY_CONFIG + '\n[sso-session x]\nsso_start_url = https://x.awsapps.com/start\n').map(p => p.name), ['dev', 'prod', 'other', 'keys'])
	})
})

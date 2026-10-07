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

	it('Should tell profile kinds apart', () => {
		const config = '[profile a]\nsso_session = x\nsso_account_id = 1\nsso_role_name = R\n\n[sso-session x]\nsso_start_url = https://x.awsapps.com/start\n\n[profile b]\nlogin_session = arn:aws:iam::123456789012:user/me\n\n[profile c]\nrole_arn = arn:aws:iam::210987654321:role/Deploy\nsource_profile = a\n\n[profile d]\ncredential_process = x\n\n[profile e]\nregion = us-east-1\n'
		const kinds = t.listProfiles(config).map(p => [p.name, p.kind])
		assert.deepEqual(kinds, [['a', 'sso'], ['b', 'login'], ['c', 'role'], ['d', 'process'], ['e', 'keys']])
		assert.equal(t.listProfiles(config).find(p => p.name == 'c').sso_account_id, '210987654321')
	})

	it('Should generate one profile per SSO account and role, skipping existing ones', () => {
		const config = '[sso-session acme]\nsso_start_url = https://acme.awsapps.com/start\nsso_region = us-east-1\n\n[profile my-prod]\nsso_session = acme\nsso_account_id = 111111111111\nsso_role_name = Admin\n'
		const entries = [
			{ accountId:'111111111111', accountName:'Prod Workloads', roleName:'Admin' },
			{ accountId:'111111111111', accountName:'Prod Workloads', roleName:'ReadOnly' },
			{ accountId:'222222222222', accountName:'', roleName:'Admin' }
		]
		const out = t.populateSsoProfiles(config, { ssoSession:'acme', entries, region:'eu-west-1', version:'2.0.0' })
		assert.deepEqual(out.added, ['acme-prod-workloads-readonly', 'acme-222222222222-admin'])
		assert.deepEqual(out.existing, ['my-prod'])
		const p = ini.getSection(out.config, 'profile acme-prod-workloads-readonly')
		assert.deepEqual(p, { sso_session:'acme', sso_account_id:'111111111111', sso_role_name:'ReadOnly', region:'eu-west-1', output:'json', switch_profile_account_name:'Prod Workloads', switch_profile_generated:'acme', switch_profile_version:'2.0.0' })
		assert.equal(t.listProfiles(out.config).find(x => x.name == 'acme-prod-workloads-readonly').accountName, 'Prod Workloads')
	})

	it('Should report and prune stale generated profiles only', () => {
		const first = t.populateSsoProfiles('[sso-session acme]\nsso_start_url = https://acme.awsapps.com/start\n\n[profile manual]\nsso_session = acme\nsso_account_id = 9\nsso_role_name = Old\n', {
			ssoSession:'acme', entries:[{ accountId:'1', accountName:'A', roleName:'R' }, { accountId:'2', accountName:'B', roleName:'R' }], version:'2.0.0'
		})
		const second = t.populateSsoProfiles(first.config, { ssoSession:'acme', entries:[{ accountId:'1', accountName:'A', roleName:'R' }], version:'2.0.0' })
		assert.deepEqual(second.stale, ['acme-b-r'])
		assert.deepEqual(second.removed, [])
		const pruned = t.populateSsoProfiles(first.config, { ssoSession:'acme', entries:[{ accountId:'1', accountName:'A', roleName:'R' }], prune:true, version:'2.0.0' })
		assert.deepEqual(pruned.removed, ['acme-b-r'])
		assert.include(pruned.config, '[profile manual]', 'hand-written profiles are never pruned')
		assert.notInclude(pruned.config, 'acme-b-r')
	})

	it('Should add only the included new profiles, without marking the others stale', () => {
		const config = '[sso-session acme]\nsso_start_url = https://acme.awsapps.com/start\n'
		const entries = [{ accountId:'1', accountName:'A', roleName:'R' }, { accountId:'2', accountName:'B', roleName:'R' }, { accountId:'3', accountName:'C', roleName:'R' }]
		const first = t.populateSsoProfiles(config, { ssoSession:'acme', entries:entries.slice(0, 2), version:'2' })
		const preview = t.populateSsoProfiles(first.config, { ssoSession:'acme', entries, version:'2' })
		assert.deepEqual(preview.addedEntries, [{ name:'acme-c-r', accountId:'3', accountName:'C', roleName:'R' }])
		const none = t.populateSsoProfiles(first.config, { ssoSession:'acme', entries, include:[], prune:true, version:'2' })
		assert.deepEqual(none.added, [])
		assert.deepEqual(none.existing, ['acme-a-r', 'acme-b-r'])
		assert.deepEqual(none.stale, [])
		assert.equal(none.config, first.config)
		const picked = t.populateSsoProfiles(config, { ssoSession:'acme', entries, include:[t.ssoEntryKey('3', 'R')], version:'2' })
		assert.deepEqual(picked.added, ['acme-c-r'])
		assert.notInclude(picked.config, 'acme-a-r')
	})

	it('Should name generated profiles predictably and avoid clashes', () => {
		assert.equal(t.generatedProfileName('Acme', 'Prod  Workloads!', '1', 'AdministratorAccess'), 'acme-prod-workloads-administratoraccess')
		const out = t.populateSsoProfiles('[sso-session acme]\nsso_start_url = https://a.awsapps.com/start\n\n[profile acme-a-r]\nregion = x\n', { ssoSession:'acme', entries:[{ accountId:'1', accountName:'A', roleName:'R' }], version:'2' })
		assert.deepEqual(out.added, ['acme-a-r-2'])
	})
})


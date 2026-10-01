const { assert } = require('chai')
const rank = require('../src/rank')

const P = [
	{ name:'acme-prod-admin', sso_account_id:'111111111111', sso_role_name:'Admin', sso_session:'acme' },
	{ name:'acme-dev-admin', sso_account_id:'222222222222', sso_role_name:'Admin', sso_session:'acme' },
	{ name:'globex-readonly', sso_account_id:'333333333333', sso_role_name:'ReadOnly', sso_session:'globex', accountName:'Globex Production' },
	{ name:'sandbox', sso_account_id:'444444444444' }
]
const NOW = Date.parse('2026-10-01T12:00:00Z')

describe('rank', () => {
	it('Should flag production accounts by name or account name', () => {
		assert.deepEqual(P.map(rank.isProd), [true, false, true, false])
		assert.isFalse(rank.isProd({ name:'products-dev' }))
		assert.isTrue(rank.isProd({ name:'client_prd' }))
	})
	it('Should put the current profile first, then frecency, then config order', () => {
		const usage = { sandbox:{ count:3, last:'2026-10-01T11:30:00Z' }, 'acme-dev-admin':{ count:10, last:'2026-08-01T00:00:00Z' } }
		assert.deepEqual(rank.rankProfiles(P, { usage, current:'globex-readonly', now:NOW }).map(p => p.name), ['globex-readonly', 'sandbox', 'acme-dev-admin', 'acme-prod-admin'])
	})
	it('Should fuzzy search across name, account id, role and client', () => {
		assert.deepEqual(rank.rankProfiles(P, { query:'acme prod' }).map(p => p.name), ['acme-prod-admin'])
		assert.deepEqual(rank.rankProfiles(P, { query:'3333' }).map(p => p.name), ['globex-readonly'])
		assert.deepEqual(rank.rankProfiles(P, { query:'readonly' }).map(p => p.name), ['globex-readonly'])
		assert.deepEqual(rank.rankProfiles(P, { query:'zzzz' }), [])
	})
	it('Should resolve exact names, unique matches and ambiguity', () => {
		assert.equal(rank.resolveQuery(P, 'SANDBOX').profile.name, 'sandbox')
		assert.equal(rank.resolveQuery(P, 'acme dev').profile.name, 'acme-dev-admin')
		const ambiguous = rank.resolveQuery(P, 'acme')
		assert.isNull(ambiguous.profile)
		assert.equal(ambiguous.candidates.length, 2)
	})
	it('Should record usage', () => {
		const u = rank.recordUsage(rank.recordUsage({}, 'a', NOW), 'a', NOW)
		assert.deepEqual(u, { a:{ count:2, last:'2026-10-01T12:00:00.000Z' } })
	})
})

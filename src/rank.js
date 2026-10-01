/**
 * Orders profiles in the picker: the current profile first, then by "frecency" (how often and how recently
 * a profile was used), and, when the user types, by fuzzy match quality across name, account, role, client
 * (SSO session) and region.
 */
const fuzzysort = require('fuzzysort')

const PROD_REGEX = /(^|[^a-z0-9])(prod|prd|production|live)([^a-z0-9]|$)/i
const HOUR = 3600 * 1000

const isProd = profile => PROD_REGEX.test(profile.name || '') || PROD_REGEX.test(profile.accountName || '')

const recencyWeight = age => {
	if (age < HOUR)
		return 4
	if (age < 24*HOUR)
		return 2
	if (age < 7*24*HOUR)
		return 1
	if (age < 30*24*HOUR)
		return 0.5
	return 0.25
}

/**
 * @param  {Object} usage		{ count, last } as stored in settings (last is an ISO date)
 * @return {Number}
 */
const frecency = (usage, now) => {
	if (!usage || !usage.count)
		return 0
	return usage.count * recencyWeight((now || Date.now()) - new Date(usage.last).getTime())
}

const searchKeys = ['name', 'accountName', 'sso_account_id', 'sso_role_name', 'sso_session', 'region']

/**
 * @param  {Array}  profiles
 * @param  {String} options.query
 * @param  {Object} options.usage		{ [profileName]: { count, last } }
 * @param  {String} options.current		Current default profile name
 * @return {Array}  Ordered profiles (filtered when there is a query)
 */
const rankProfiles = (profiles, { query, usage, current, now } = {}) => {
	usage = usage || {}
	const score = p => frecency(usage[p.name], now)
	const q = (query || '').trim()
	if (!q) {
		return profiles
			.map((p, i) => ({ p, i, s: score(p) }))
			.sort((a, b) => (b.p.name == current) - (a.p.name == current) || b.s - a.s || a.i - b.i)
			.map(x => x.p)
	}

	const results = fuzzysort.go(q, profiles, { keys:searchKeys, threshold:0.3 })
	return results
		.map(r => ({ p: r.obj, s: r.score + Math.min(score(r.obj), 10) * 0.01 }))
		.sort((a, b) => b.s - a.s)
		.map(x => x.p)
}

/**
 * Resolves what the user typed after the command (e.g., 'sp acme-prod').
 *
 * @return {Object} { profile } when there is a single obvious match, otherwise { candidates }
 */
const resolveQuery = (profiles, query, options) => {
	const q = (query || '').trim().toLowerCase()
	const exact = profiles.find(p => p.name.toLowerCase() == q)
	if (exact)
		return { profile:exact, candidates:[exact] }
	const candidates = rankProfiles(profiles, { ...options, query })
	return candidates.length == 1 ? { profile:candidates[0], candidates } : { profile:null, candidates }
}

/**
 * Returns the new usage map after a profile was used.
 */
const recordUsage = (usage, name, now) => {
	const current = (usage || {})[name] || { count:0 }
	return { ...(usage || {}), [name]: { count: current.count + 1, last: new Date(now || Date.now()).toISOString() } }
}

module.exports = {
	isProd,
	frecency,
	rankProfiles,
	resolveQuery,
	recordUsage
}

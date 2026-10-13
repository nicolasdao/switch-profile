/**
 * Chooses how 'aws sso login' authenticates.
 *
 * Since AWS CLI 2.22.0, 'aws sso login' defaults to the PKCE flow, which needs a browser on the same machine
 * as the CLI. That hangs on a remote machine reached over SSH. '--use-device-code' prints a URL and a code
 * that can be approved from any device instead. Before 2.22.0, device code was the only flow and the flag
 * did not exist.
 */

const DEVICE_CODE_MIN_CLI = [2, 22, 0]

const atLeast = (version, min) => {
	const parts = (version || '').split('.').map(n => parseInt(n, 10) || 0)
	for (let i=0; i<min.length; i++) {
		if ((parts[i]||0) != min[i])
			return (parts[i]||0) > min[i]
	}
	return true
}

/**
 * True when this terminal is most likely on a machine without a usable local browser.
 */
const isRemoteSession = (env, platform) => {
	env = env || {}
	if (env.SSH_CONNECTION || env.SSH_CLIENT || env.SSH_TTY)
		return true
	return platform == 'linux' && !env.DISPLAY && !env.WAYLAND_DISPLAY
}

/**
 * Resolves the login mode setting into the effective flow.
 *
 * @param  {String} mode		'auto' | 'device' | 'browser'
 * @return {String}				'device' | 'browser'
 */
const resolveLoginMode = (mode, { env, platform }) => {
	if (mode == 'device' || mode == 'browser')
		return mode
	return isRemoteSession(env, platform) ? 'device' : 'browser'
}

/**
 * Extra arguments for 'aws sso login'.
 *
 * @param  {String} mode
 * @param  {Object} context.env
 * @param  {String} context.platform
 * @param  {String} context.cliVersion		e.g., '2.33.17'
 * @return {Array}
 */
const loginFlags = (mode, { env, platform, cliVersion }) => {
	if (!atLeast(cliVersion, DEVICE_CODE_MIN_CLI))
		return [] // Device code is the only (default) flow on these versions.
	// '--no-browser' makes the CLI print the URL that pre-fills the code, which the QR code encodes.
	// switch-profile opens the browser itself when the machine has one.
	return resolveLoginMode(mode, { env, platform }) == 'device' ? ['--use-device-code', '--no-browser'] : []
}

const URL_REGEX = /https:\/\/\S+/g
const CODE_REGEX = /enter the code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})\b/i

/**
 * Parses what 'aws sso login' printed so far.
 *
 * Device code ('--no-browser') output looks like:
 * 	Browser will not be automatically opened.
 * 	Please visit the following URL:
 *
 * 	https://device.sso.us-east-1.amazonaws.com/
 *
 * 	Then enter the code:
 *
 * 	ABCD-EFGH
 *
 * 	Alternatively, you may visit the following URL which will autofill the code upon loading:
 * 	https://device.sso.us-east-1.amazonaws.com/?user_code=ABCD-EFGH
 *
 * @param  {String} text
 * @return {Object} { url, code, completeUrl }	Each may be null.
 */
const parseLoginOutput = text => {
	text = text || ''
	const urls = text.match(URL_REGEX) || []
	const code = ((text.match(CODE_REGEX) || [])[1] || null)
	const completeUrl = urls.find(u => /user_code=/.test(u)) || null
	const url = urls.find(u => u !== completeUrl) || completeUrl || null
	return { url, code, completeUrl }
}

const WRONG_REGION = /Invalid start url|invalid_request|InvalidRequestException/i

/**
 * Whether the AWS CLI's output is how AWS answers a start URL sent to the wrong SSO region (pure).
 * 'aws sso login' gets 'invalid_request' from StartDeviceAuthorization; 'aws configure sso' gets
 * 'Invalid start url provided' from RegisterClient.
 *
 * @param  {String}  output
 * @return {Boolean}
 */
const isWrongSsoRegion = output => WRONG_REGION.test(output || '')

const PORTAL_REGION = /portal\.sso\.([a-z]{2}(?:-[a-z]+)+-\d+)\.amazonaws\.com/

/**
 * The SSO region of a portal, read from the headers of its start page (pure). The page links to its
 * regional portal API, e.g. 'Link: <https://portal.sso.ap-southeast-2.amazonaws.com/>; rel=preconnect'.
 * Not a documented contract: treat the result as a suggestion for the user to confirm.
 *
 * @param  {Array}  values	Header values to search (e.g., Link, Content-Security-Policy)
 * @return {String}			e.g., 'ap-southeast-2', or null
 */
const portalRegionFromHeaders = values => {
	for (const v of values || []) {
		const m = (v || '').match(PORTAL_REGION)
		if (m)
			return m[1]
	}
	return null
}

/**
 * Explains a failed 'aws configure sso' (pure). AWS answers a start URL sent to the wrong SSO region with
 * 'Invalid start url provided', which points users at the URL instead of the region.
 *
 * @param  {String} output		What the AWS CLI printed on stderr
 * @param  {Array}  sessions	Existing [sso-session] sections: [{ name, sso_start_url, sso_region }]
 * @return {Object} { message, hint }
 */
const configureSsoFailure = (output, sessions) => {
	const lines = (output || '').split('\n').map(l => l.trim()).filter(Boolean)
	const detail = (lines.filter(l => /error/i.test(l)).slice(-1)[0] || lines.slice(-1)[0] || '').replace(/^aws:\s*\[ERROR\]:\s*/i, '')
	const description = ((output || '').match(/error_description:\s*(.+)/) || [])[1]
	const known = (sessions || []).filter(s => s.sso_region).map(s => `${s.name} (${s.sso_region}, ${s.sso_start_url})`)
	const reuse = known.length ? ` Portals already set up here: ${known.join(', ')}. Type one of these names as the session name to reuse it.` : ''
	const message = `aws configure sso failed${description || detail ? `: ${(description || detail).trim()}` : '.'}`
	if (isWrongSsoRegion(output))
		return { message, hint:`The SSO region is most likely wrong: it must be the region where IAM Identity Center lives (Identity Center console › Settings), not where you deploy. AWS reports a wrong region as an invalid start URL.${reuse}` }
	return { message, hint:`Run sp add to try again.${reuse}` }
}

module.exports = {
	configureSsoFailure,
	isWrongSsoRegion,
	portalRegionFromHeaders,
	isRemoteSession,
	resolveLoginMode,
	loginFlags,
	parseLoginOutput,
	atLeast
}

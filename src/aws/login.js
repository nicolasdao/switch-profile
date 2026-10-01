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
	return resolveLoginMode(mode, { env, platform }) == 'device' ? ['--use-device-code'] : []
}

module.exports = {
	isRemoteSession,
	resolveLoginMode,
	loginFlags
}

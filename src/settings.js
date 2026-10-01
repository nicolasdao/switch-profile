/**
 * The tool's own state, stored in ~/.switch-profile/settings.json.
 *
 * 'formatVersion' describes how switch-profile stores things in the user's AWS files. It only changes when
 * that storage format changes, and it is what migrations key off. 'lastWrittenBy' is the CLI version that
 * last wrote the files, for diagnosis.
 *
 * Format history:
 * 	1 - (switch-profile <= 1.x, no settings file) temporary credentials copied into [default] of ~/.aws/credentials,
 * 	    plus custom 'profile' and 'expiry_date' keys.
 * 	2 - [default] of ~/.aws/config holds the selected profile's settings (not credentials), stamped with
 * 	    'switch_profile_name' and 'switch_profile_version'.
 */
const fs = require('fs')
const { homedir } = require('os')
const { join } = require('path')
const { version } = require('../package.json')

const FORMAT_VERSION = 2
const SETTINGS_DIR = join(homedir(), '.switch-profile')
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.json')

const LOGIN_MODES = ['auto', 'device', 'browser']

const read = async () => {
	try {
		const text = await fs.promises.readFile(SETTINGS_FILE, 'utf8')
		return JSON.parse(text) || {}
	} catch(err) {
		if (err.code == 'ENOENT')
			return {}
		throw new Error(`Fail to read ${SETTINGS_FILE}: ${err.message}`)
	}
}

/**
 * Merges 'changes' into the settings file and stamps it with the current CLI version.
 */
const update = async changes => {
	const current = await read()
	const next = {
		...current,
		...changes,
		formatVersion: changes && changes.formatVersion !== undefined ? changes.formatVersion : (current.formatVersion || FORMAT_VERSION),
		createdBy: current.createdBy || version,
		lastWrittenBy: version,
		updatedAt: new Date().toISOString()
	}
	await fs.promises.mkdir(SETTINGS_DIR, { recursive:true })
	await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(next, null, '  ') + '\n')
	return next
}

const getLoginMode = settings => LOGIN_MODES.includes(settings && settings.loginMode) ? settings.loginMode : 'auto'

module.exports = {
	FORMAT_VERSION,
	SETTINGS_FILE,
	LOGIN_MODES,
	CLI_VERSION: version,
	read,
	update,
	getLoginMode
}

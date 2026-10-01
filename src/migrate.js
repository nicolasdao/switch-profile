/**
 * Upgrades what previous switch-profile versions left on the user's machine. See src/settings.js for the
 * format history. Every migration backs up ~/.aws/config and ~/.aws/credentials before changing them.
 */
const settings = require('./settings')
const aws = require('./aws')
const transforms = require('./aws/transforms')

class NewerFormatError extends Error {}

const readAwsFiles = async () => {
	const [configErrors, config] = await aws.getConfigFile()
	const [credsErrors, creds] = await aws.getCredsFile()
	if (configErrors || credsErrors)
		throw new Error(((configErrors || credsErrors)[0]||{}).message || 'Fail to read the AWS files')
	return { config, creds }
}

const backup = async () => {
	const [errors, backups] = await aws.backupAwsFiles()
	if (errors)
		throw new Error(`Fail to back up the AWS files: ${(errors[0]||{}).message}`)
	return backups
}

/**
 * Runs the automatic migrations. Safe to call on every start: it does nothing once the format is current.
 *
 * @return {Boolean} result.migrated		True if the AWS files were changed.
 * @return {Array}   result.backups			Backups created.
 * @return {String}  result.defaultProfile	The default profile that was carried over (format 1 -> 2).
 */
const runMigrations = async () => {
	const current = await settings.read()
	if (current.formatVersion > settings.FORMAT_VERSION)
		throw new NewerFormatError(`Your AWS profiles were last managed by switch-profile ${current.lastWrittenBy || '(unknown version)'}, which is newer than this version (${settings.CLI_VERSION}). Please run the latest version: npx switch-profile@latest`)

	// Format 1 -> 2: temporary credentials copied into [default] of ~/.aws/credentials. This is checked on
	// every start, not only when the format version is old, so that running switch-profile 1.x again
	// (e.g., 'npx switch-profile@1') is healed by the next 2.x run.
	let { config, creds } = await readAwsFiles()
	const result = { migrated:false, backups:[], defaultProfile:null }
	if (transforms.hasLegacyDefault(creds)) {
		result.backups = await backup()
		// The 1.x 'profile' key is the most recent choice, so it wins over any 2.x stamp in ~/.aws/config.
		const name = transforms.getLegacyDefaultProfileName(creds)
		if (name && name != 'default' && transforms.configSectionName(config, name)) {
			const next = transforms.setDefaultProfile(config, creds, name, settings.CLI_VERSION)
			config = next.config
			creds = next.creds
			result.defaultProfile = name
		} else
			creds = transforms.stripLegacyDefault(creds)
		await aws.writeAwsFiles({ config, creds })
		result.migrated = true
	}

	if (result.migrated || current.formatVersion !== settings.FORMAT_VERSION)
		await settings.update({ formatVersion:settings.FORMAT_VERSION, ...(result.migrated ? { migratedFrom:1 } : {}) })
	return result
}

/**
 * Lists the profiles still using the legacy SSO format.
 */
const findLegacySsoProfiles = async () => {
	const { config } = await readAwsFiles()
	return transforms.findLegacySsoProfiles(config)
}

/**
 * Converts legacy SSO profiles to the [sso-session] format (auto-refresh). If the current default profile is
 * one of them, [default] is rewritten too.
 *
 * @param  {Array} names
 * @return {Array} result.sessions		See transforms.upgradeLegacySsoProfiles
 * @return {Array} result.backups
 */
const upgradeLegacySsoProfiles = async names => {
	const backups = await backup()
	let { config, creds } = await readAwsFiles()
	const upgraded = transforms.upgradeLegacySsoProfiles(config, names, settings.CLI_VERSION)
	config = upgraded.config
	const active = transforms.getDefaultProfileName(config, creds)
	if (active && names.includes(active) && transforms.configSectionName(config, active)) {
		const next = transforms.setDefaultProfile(config, creds, active, settings.CLI_VERSION)
		config = next.config
		creds = next.creds
	}
	await aws.writeAwsFiles({ config, creds })
	await settings.update({})
	return { sessions:upgraded.sessions, backups }
}

module.exports = {
	NewerFormatError,
	runMigrations,
	findLegacySsoProfiles,
	upgradeLegacySsoProfiles
}

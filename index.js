#!/usr/bin/env node

// NOTE: The official inquirer documentation is really good. To know more about the different question types,
// please refer to https://www.npmjs.com/package/inquirer#prompt-types

const program = require('commander')
const inquirer = require('inquirer')
const { EOL } = require('os')
const IS_WINDOWS = process.platform === 'win32'
const { listProfiles, ensureCredentials, getSsoLoginStatus, getDefaultProfile, setDefaultProfile, deleteProfiles, createProfile, regions, createSsoProfile, awsCliV2Exists } = require('./src/aws')
const { resolveLoginMode } = require('./src/aws/login')
const { printAWSerrors } = require('./src/core')
const settings = require('./src/settings')
const shell = require('./src/shell')
const migrate = require('./src/migrate')
require('colors')
const { version } = require('./package.json')
program.version(version) // This is required is you wish to support the --version option.

const OPTIONS_KEY = '_options_4s2s3a'
const ABORT_KEY = '_abort_rfewq1'

inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'))

const chooseProfileName = async (denyList) => {
	let { name } = await inquirer.prompt([
		{ 
			type: 'input', 
			name: 'name', 
			message: 'Enter a profile name (alphanumerical lowercase and \'-\' characters only)'
		}
	])

	if (!name) {
		console.log('Profile name is required. Please try again.'.red)
		name = await chooseProfileName()
	} 

	if (/[^a-z0-9_-]/.test(name)) {
		console.log('Profile name contained invalid characters. Only alphanumerical lowercase and \'-\' characters are allowed. Please try again.'.red)
		name = await chooseProfileName()
	}

	if (name.length < 2) {
		console.log('Profile name is not long enough. The profile name must be longer or equal to 2 characters. Please try again.'.red)
		name = await chooseProfileName()
	}	

	if (denyList && denyList.some(n => n == name)) {
		console.log(`Profile name ${name.bold} already exist. Please try again.`.red)
		name = await chooseProfileName()
	}

	return name
}

const chooseNonEmpty = async (prop, message) => {
	let { value } = await inquirer.prompt([
		{ 
			type: 'input', 
			name: 'value', 
			message
		}
	])

	if (!value) {
		console.log(`${prop} cannot be empty. Please try again.`.red)
		value = await chooseNonEmpty(prop, message)
	} 

	return value
}

const chooseRegions = async () => {
	const { region } = await inquirer.prompt([
		{ 
			type: 'autocomplete', 
			name: 'region', 
			message: 'Select a region:',
			pageSize: 20,
			source: function(answersSoFar, input) {
				if (input) 
					return regions.filter(r => `${r.code} - ${r.name}`.toLowerCase().indexOf(input.toLowerCase()) >= 0).map(r => ({
						name: `${r.code} - ${r.name}`,
						value:r.code
					}))
				else
					return regions.map(r => ({
						name: `${r.code} - ${r.name}`,
						value:r.code
					}))
			}
		}
	])

	return region
}

const createNewProfile = async (profiles, makeItDefault) => {
	const name = await chooseProfileName(profiles.map(p => p.name))
	const { type } = await inquirer.prompt([
		{ 
			type: 'list', 
			name: 'type', 
			message: 'Choose an AWS profile type: ',
			choices: ['standard','sso']
		}
	])

	if (type == 'standard') {
		const aws_access_key_id = await chooseNonEmpty('aws_access_key_id', 'Enter the profile\'s access key:')
		const aws_secret_access_key = await chooseNonEmpty('aws_secret_access_key', 'Enter the profile\'s access secret key:')
		const region = await chooseRegions()
		const [profileErrors] = await createProfile({ name, aws_access_key_id, aws_secret_access_key, region })
		if (profileErrors)
			return printAWSerrors([new Error('Fail to create profile'), ...profileErrors])
	} else {
		console.log('')
		console.log('┌─────────────────────────────────────────────────────────────────────┐'.cyan)
		console.log('│                     SSO Profile Setup Guide                         │'.cyan)
		console.log('├─────────────────────────────────────────────────────────────────────┤'.cyan)
		console.log('│                                                                     │'.cyan)
		console.log('│  You\'re about to run \'aws configure sso\'. Here\'s what to expect:    │'.cyan)
		console.log('│                                                                     │'.cyan)
		console.log('│  1. SSO session name'.bold + '                                                │'.cyan)
		console.log('│     Provide a name (e.g., "my-company-sso"). Reuse the same name    │'.cyan)
		console.log('│     for every profile of the same SSO portal: one login covers all.  │'.cyan)
		console.log('│     It enables automatic refresh (if skipped, switch-profile adds    │'.cyan)
		console.log('│     one for you).                                                    │'.cyan)
		console.log('│                                                                     │'.cyan)
		console.log('│  2. SSO start URL'.bold + '                                                   │'.cyan)
		console.log('│     Your AWS SSO portal URL (e.g., https://my-co.awsapps.com/start) │'.cyan)
		console.log('│     Ask your AWS administrator if you don\'t have it.                 │'.cyan)
		console.log('│                                                                     │'.cyan)
		console.log('│  3. SSO region'.bold + '                                                      │'.cyan)
		console.log('│     The region where your SSO instance is configured.                │'.cyan)
		console.log('│     WARNING: This is NOT your deployment region.                     │'.yellow)
		console.log('│     Using the wrong region causes "invalid_grant" errors.            │'.yellow)
		console.log('│                                                                     │'.cyan)
		console.log('│  Docs: https://docs.aws.amazon.com/cli/latest/userguide/            │'.cyan)
		console.log('│        cli-configure-sso.html                                       │'.cyan)
		console.log('│                                                                     │'.cyan)
		console.log('└─────────────────────────────────────────────────────────────────────┘'.cyan)
		console.log('')

		const [ssoErrors, upgraded] = await createSsoProfile(name)
		if (ssoErrors)
			return printAWSerrors([new Error(`Fail to create SSO profile ${name}`), ...ssoErrors])
		if (upgraded)
			console.log(`No SSO session name was provided, so ${name.bold} was converted to the [sso-session] format to enable auto-refresh. You will be asked to log in once more.`.yellow)
	}

	console.log(`New profile ${name.bold} successfully created 🚀`.green)

	if (makeItDefault === false)
		return 

	if (makeItDefault === undefined) {
		const { setAsDefault } = await inquirer.prompt([
			{ 
				type: 'confirm', 
				name: 'setAsDefault', 
				message: 'Do you wish to set this new profile as the default?',
			}
		])

		if (!setAsDefault)
			return  
	}

	const [listErrors2, profiles2] = await listProfiles()
	if (listErrors2)
		return printAWSerrors([new Error('Fail to list profiles'), ...listErrors2])

	await setProfileToDefault(name, profiles2)
}

const printAwsCliInstallHelp = () => {
	if (process.platform == 'darwin') {
		console.log('AWS CLI seems to not be installed. Try installing it as follow\n'.red)
		console.log('brew install awscli')
		console.log('brew link --overwrite awscli')
	} else if (process.platform == 'win32') {
		console.log('AWS CLI seems to not be installed. Download the installer from:\n'.red)
		console.log('https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html')
	} else {
		console.log('AWS CLI seems to not be installed. Try installing it as follow\n'.red)
		console.log('curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"')
		console.log('unzip awscliv2.zip')
		console.log('sudo ./aws/install')
	}
}

/**
 * Runs the automatic migrations, offers the one-time legacy SSO upgrade and keeps the 'sp' shortcut current.
 *
 * @return {Boolean} False if the program must stop.
 */
const startup = async () => {
	try {
		const result = await migrate.runMigrations()
		if (result.migrated) {
			console.log(`${EOL}switch-profile ${version} upgraded your AWS setup:`.cyan)
			console.log(`  - [default] now holds ${result.defaultProfile ? `profile ${result.defaultProfile.bold}'s` : 'the selected profile\'s'} settings instead of copied temporary credentials, so AWS tools refresh credentials on their own.`.cyan)
			console.log(`  - Backups: ${result.backups.join(', ')}`.cyan)
		}
	} catch(err) {
		printAWSerrors([err], { noStack: err instanceof migrate.NewerFormatError })
		return false
	}

	const current = await settings.read()
	if (!current.ssoUpgradeDeclined) {
		const legacy = await migrate.findLegacySsoProfiles()
		if (legacy.length) {
			const label = legacy.length > 1 ? `${legacy.length} profiles use` : '1 profile uses'
			console.log(`${EOL}${label} the old SSO format, which has no auto-refresh: ${legacy.join(', ')}`.yellow)
			const { upgrade } = await inquirer.prompt([{
				type: 'confirm',
				name: 'upgrade',
				message: 'Upgrade them to the [sso-session] format? You will log in once per SSO portal.'
			}])
			if (upgrade)
				await upgradeLegacySso(legacy)
			else {
				await settings.update({ ssoUpgradeDeclined:true })
				console.log('OK. You can upgrade later in More options > Settings.'.cyan)
			}
		}
	}

	const status = await shell.getStatus(version).catch(() => null)
	if (status && status.installed && status.outdated) {
		const updated = await shell.install(version).then(() => true).catch(() => false)
		if (updated)
			console.log(`Updated the ${shell.FUNCTION_NAME.bold} shortcut in ${status.shell.files.map(shell.tilde).join(', ')}. Open a new terminal to use the new version.`.cyan)
	}
	return true
}

const upgradeLegacySso = async names => {
	try {
		const { sessions, backups } = await migrate.upgradeLegacySsoProfiles(names)
		console.log(`Upgraded ${names.length} profile${names.length > 1 ? 's' : ''}. Backups: ${backups.join(', ')}`.green)
		sessions.forEach(s => console.log(`  [sso-session ${s.name}] (${s.startUrl}): ${s.profiles.join(', ')}`.green))
		console.log('You will be asked to log in once per SSO session the next time you use those profiles.'.cyan)
	} catch(err) {
		printAWSerrors([new Error('Fail to upgrade the legacy SSO profiles'), err])
	}
}

/**
 * Prints the current default profile and its login status.
 *
 * @return {Boolean} needsLogin		True if the default profile is an SSO profile whose login has expired.
 */
const printStatus = async (defaultProfile) => {
	const messages = []
	let needsLogin = false
	if (defaultProfile) {
		messages.push(`Current default profile: ${defaultProfile.name.bold}`.cyan)
		if (defaultProfile.isSso) {
			const [, login] = await getSsoLoginStatus(defaultProfile.sso_start_url)
			const state = login ? login.state : 'none'
			if (state == 'refreshable')
				messages.push(' INFO: SSO login active, auto-refresh on'.cyan)
			else if (state == 'active') {
				const minutes = ((login.expiresAt.getTime() - Date.now())/60000).toFixed(0)
				messages.push(` INFO: SSO login expires in ${minutes} minutes (no auto-refresh)`.cyan)
			} else {
				needsLogin = true
				messages.push(` WARNING: ${state == 'expired' ? 'SSO login expired' : 'Not logged in'}`.yellow)
			}
		}
	} else
		messages.push(`Current default profile: ${'unknown'.bold} (pick one up in the list below and we'll remember next time)`.cyan)

	if (process.env.AWS_PROFILE && (!defaultProfile || process.env.AWS_PROFILE != defaultProfile.name))
		messages.push(`${EOL}This terminal uses: ${process.env.AWS_PROFILE.bold} (AWS_PROFILE, overrides the default)`.cyan)

	console.log(EOL + messages.join('') + EOL)
	return needsLogin
}

const switchCmd = async () => {
	const [awsCliErrors, awsCliExists] = await awsCliV2Exists(true)
	if (awsCliErrors)
		return printAWSerrors(awsCliErrors, { noStack:true })

	if (!awsCliExists)
		return printAwsCliInstallHelp()

	if (!(await startup()))
		return

	const [defaultProfileErrors, defaultProfileInfo] = await getDefaultProfile()
	if (defaultProfileErrors)
		return printAWSerrors([new Error('Fail to get default profile'), ...defaultProfileErrors])

	const [listErrors, profiles] = await listProfiles()
	if (listErrors)
		return printAWSerrors([new Error('Fail to list profiles'), ...listErrors])

	const defaultProfile = profiles.find(p => p.name == defaultProfileInfo.profile) || null
	const defaultProfileName = defaultProfile ? defaultProfile.name : ''
	const defaultProfileExpired = await printStatus(defaultProfile)

	const profileCount = profiles.length

	if (!profileCount) {
		const { create } = await inquirer.prompt([
			{ 
				type: 'confirm', 
				name: 'create', 
				message: 'There no profiles yet. Do you wish to create one now? ',
			}
		])

		if (!create)
			return 

		console.log('Ooh yeah ✨! I like your style. Let\'s do this!'.cyan)
		await createNewProfile([], true)
	} else {
		const { friendlyName } = await inquirer.prompt([
			{ 
				type: 'list', 
				name: 'friendlyName', 
				message: `Choose one of the following ${profileCount} profiles:`,
				pageSize:20,
				default: 2,
				choices: [
					{ name:'More options', value:OPTIONS_KEY }, 
					{ name: 'Abort', value:ABORT_KEY }, 
					new inquirer.Separator(), ...profiles.map((p,i) => {
						return { 
							name: `${i+1}. ${p.friendlyName}`, 
							value: p.friendlyName
						}
					})]
			}
		])
		
		if (!friendlyName || friendlyName == ABORT_KEY)
			return

		if (friendlyName == OPTIONS_KEY) {
			const { option } = await inquirer.prompt([
				{ 
					type: 'list', 
					name: 'option', 
					message: 'Options:',
					pageSize:20,
					choices: [
						...(defaultProfileExpired ? [{ name: `Log in again (default profile ${defaultProfileName.bold})` ,value:'refresh' }] : []),
						{ name: 'Create profile', value:'new' }, 
						{ name: 'Delete profiles', value:'delete' },
						{ name: 'Settings', value:'settings' },
						{ name: 'Abort', value:ABORT_KEY }
					]
				}
			])

			if (option == 'refresh')
				await setProfileToDefault(defaultProfileName, profiles, { force:true, successMsg:`AWS profile ${defaultProfileName.bold} successfully refreshed.` })
			else if (option == 'settings')
				await settingsMenu()
			else if (option == 'delete') {
				const { delProfiles } = await inquirer.prompt([
					{
						type: 'checkbox',
						name: 'delProfiles',
						message: 'Select the profiles you wish to delete (SPACE to select, ENTER to confirm):',
						pageSize: 20,
						choices: profiles.map((p,i) => {
						return {
							name: `${i+1}. ${p.friendlyName}`,
							value: p.name
						}
					})
					}
				])

					if (!delProfiles.length)
						return

						const label = delProfiles.length > 1 ? 'profiles' : 'profile'
						const labelText = delProfiles.length > 1 ? `those ${delProfiles.length} profiles` : 'this profile'
						const { delConfirm } = await inquirer.prompt([
							{
								type: 'confirm',
								name: 'delConfirm',
								message: `Are you sure you want to delete ${labelText}? `,
							}
						])

					if (!delConfirm)
						return

						if (defaultProfileName && delProfiles.some(p => p == defaultProfileName)) {
							return printAWSerrors([new Error(`Fail to delete ${label}. Profile ${defaultProfileName.bold} is the current default. Set another profile as the default, then try deleting again.`)], { noStack:true })
						}

						const [delErrors] = await deleteProfiles(delProfiles)
						if (delErrors)
							return printAWSerrors([new Error(`Fail to delete ${label}`), ...delErrors])

						console.log(`AWS profile${delProfiles.length > 1 ? 's' : ''} successfully deleted.`.green)
			} else if (option == 'new')
				await createNewProfile(profiles)
			else if (option == ABORT_KEY)
				return

			return 
		} else
			await setProfileToDefault(friendlyName, profiles)
	}
}

const printExportHint = (profileName) => {
	const lines = IS_WINDOWS ? [
		'  To lock this profile to this terminal session, run:  ',
		'',
		`    PowerShell:  $env:AWS_PROFILE = "${profileName}"`,
		`    CMD:         set AWS_PROFILE=${profileName}`,
		'',
		'  This prevents other terminals from affecting this one.  '
	] : [
		'  To lock this profile to this terminal session, run:  ',
		'',
		`    export AWS_PROFILE=${profileName}`,
		'',
		'  This prevents other terminals from affecting this one.  '
	]
	const width = Math.max(...lines.map(l => l.length))
	const pad = s => s + ' '.repeat(width - s.length)
	console.log('')
	console.log(('┌' + '─'.repeat(width) + '┐').cyan)
	const boldStart = IS_WINDOWS ? 2 : 2
	const boldEnd = IS_WINDOWS ? 3 : 2
	for (let i = 0; i < lines.length; i++) {
		const content = '│' + pad(lines[i]) + '│'
		console.log(i >= boldStart && i <= boldEnd ? content.cyan.bold : content.cyan)
	}
	console.log(('└' + '─'.repeat(width) + '┘').cyan)
	console.log('')
}

/**
 * Makes a profile the default and, when launched through the 'sp' shortcut, the profile of this terminal.
 *
 * @param  {String}  profileName
 * @param  {Array}   profileList
 * @param  {String}  options.successMsg
 * @param  {Boolean} options.force		Logs in to SSO again even if the session is still valid.
 */
const setProfileToDefault = async (profileName, profileList, options) => {
	const { successMsg, force } = options || {}
	const profile = profileList.find(p => p.friendlyName == profileName || p.name == profileName)

	if (!profile)
		return printAWSerrors([new Error(`Profile ${profileName.bold} was not found in ~/.aws/config. It may not have been created correctly. Try creating it again.`)], { noStack:true })

	// For SSO profiles, logs in if the session is missing or expired. Credentials are not copied anywhere:
	// AWS tools resolve and refresh them from the profile's settings.
	const current = await settings.read()
	const [credsErrors] = await ensureCredentials(profile, { loginMode:settings.getLoginMode(current), force })
	if (credsErrors)
		return printAWSerrors([new Error(`Fail to get credentials for profile ${profile.name}`), ...credsErrors], { noStack:true })

	const [errors] = await setDefaultProfile(profile.name)
	if (errors)
		return printAWSerrors([new Error('Fail to update the default profile'), ...errors])
	await settings.update({})

	console.log((successMsg || `AWS profile ${profile.name.bold} successfully set up as default.`).green)
	await afterSwitch(profile.name)
}

/**
 * Applies the profile to this terminal when possible, otherwise tells the user how to.
 */
const afterSwitch = async profileName => {
	if (await shell.exportProfile(profileName).catch(() => false)) {
		console.log(`This terminal now uses ${profileName.bold} (AWS_PROFILE).`.green)
		return
	}

	const status = await shell.getStatus(version).catch(() => null)
	if (status && status.installed) {
		printExportHint(profileName)
		console.log(`Tip: per-terminal switching is set up. Run ${shell.FUNCTION_NAME.bold} instead of switch-profile to apply the profile to this terminal automatically.`.cyan)
		console.log(`If ${shell.FUNCTION_NAME.bold} is not found, this terminal hasn't loaded it yet: open a new terminal or run ${status.shell.reload.bold}`.cyan)
		printPowerShellPolicyHint(status)
		return
	}

	printExportHint(profileName)
	if (!status || !status.supported)
		return

	const current = await settings.read()
	if (current.perTerminalPrompted) {
		console.log('Tip: enable automatic per-terminal switching in More options > Settings.'.cyan)
		return
	}

	const files = status.shell.files.map(shell.tilde).join(', ')
	const { enable } = await inquirer.prompt([{
		type: 'confirm',
		name: 'enable',
		message: `Enable per-terminal switching? This adds a ${shell.FUNCTION_NAME} shortcut to ${files}, so you never have to copy the command above.`
	}])
	await settings.update({ perTerminalPrompted:true })
	if (enable)
		await enablePerTerminal()
	else
		console.log('OK. You can enable it later in More options > Settings.'.cyan)
}

const enablePerTerminal = async () => {
	try {
		const installed = await shell.install(version)
		console.log(`Done. Added the ${shell.FUNCTION_NAME.bold} shortcut to ${installed.files.map(shell.tilde).join(', ')}.`.green)
		console.log(`Open a new terminal or run ${installed.reload.bold}, then use ${shell.FUNCTION_NAME.bold} to switch profiles.`.green)
		printPowerShellPolicyHint({ shell:installed })
	} catch(err) {
		printAWSerrors([new Error('Fail to enable per-terminal switching'), err], { noStack:true })
	}
}

const printPowerShellPolicyHint = status => {
	if (status && status.shell && status.shell.name == 'powershell')
		console.log(`If PowerShell refuses to load your profile, allow local scripts with: ${'Set-ExecutionPolicy -Scope CurrentUser RemoteSigned'.bold}`.cyan)
}

const perTerminalLabel = status => {
	if (!status.supported)
		return IS_WINDOWS ? 'Not available in this shell (use PowerShell)' : 'Not available for this shell (supported: zsh, bash, fish)'
	if (!status.installed)
		return 'Disabled'
	const files = status.shell.files.map(shell.tilde).join(', ')
	if (status.active)
		return `Enabled (${files}), active in this terminal`
	return `Enabled (${files}), not loaded in this terminal. Run ${status.shell.reload} or open a new terminal, then use ${shell.FUNCTION_NAME}`
}

const LOGIN_MODE_LABELS = {
	auto: 'Auto (device code over SSH, browser otherwise)',
	device: 'Always device code (approve from any device)',
	browser: 'Always browser on this machine'
}

const settingsMenu = async () => {
	for (;;) {
		const current = await settings.read()
		const status = await shell.getStatus(version)
		const legacy = await migrate.findLegacySsoProfiles()
		const loginMode = settings.getLoginMode(current)
		const effective = resolveLoginMode(loginMode, { env:process.env, platform:process.platform })

		console.log('')
		console.log('Settings'.bold)
		console.log(`  Per-terminal switching:  ${perTerminalLabel(status)}`)
		console.log(`  SSO login mode:          ${LOGIN_MODE_LABELS[loginMode]}${loginMode == 'auto' ? ` - here: ${effective == 'device' ? 'device code' : 'browser'}` : ''}`)
		console.log(`  Legacy SSO profiles:     ${legacy.length ? `${legacy.length} without auto-refresh (${legacy.join(', ')})` : 'none'}`)
		console.log(`  Settings file:           ${shell.tilde(settings.SETTINGS_FILE)} (format v${current.formatVersion || settings.FORMAT_VERSION}, last written by switch-profile ${current.lastWrittenBy || version})`)
		console.log('')

		const { action } = await inquirer.prompt([{
			type: 'list',
			name: 'action',
			message: 'Settings:',
			pageSize: 20,
			choices: [
				...(status.supported ? [status.installed
					? { name:'Disable per-terminal switching', value:'disable' }
					: { name:'Enable per-terminal switching', value:'enable' }] : []),
				{ name:'Change SSO login mode', value:'login' },
				...(legacy.length ? [{ name:`Upgrade ${legacy.length} legacy SSO profile${legacy.length > 1 ? 's' : ''}`, value:'upgrade' }] : []),
				{ name:'Back', value:ABORT_KEY }
			]
		}])

		if (action == 'enable') {
			await settings.update({ perTerminalPrompted:true })
			await enablePerTerminal()
		} else if (action == 'disable') {
			const removed = await shell.uninstall().catch(err => printAWSerrors([new Error('Fail to disable per-terminal switching'), err], { noStack:true }))
			if (removed) {
				await settings.update({ perTerminalPrompted:true })
				console.log(`Removed the ${shell.FUNCTION_NAME.bold} shortcut from ${removed.files.map(shell.tilde).join(', ')}. Terminals already open keep it until they are closed.`.green)
			}
		} else if (action == 'login') {
			const { mode } = await inquirer.prompt([{
				type: 'list',
				name: 'mode',
				message: 'How should SSO logins happen?',
				default: loginMode,
				choices: settings.LOGIN_MODES.map(m => ({ name:LOGIN_MODE_LABELS[m], value:m }))
			}])
			await settings.update({ loginMode:mode })
			console.log(`SSO login mode set to: ${LOGIN_MODE_LABELS[mode]}`.green)
		} else if (action == 'upgrade') {
			await upgradeLegacySso(legacy)
			await settings.update({ ssoUpgradeDeclined:false })
		} else
			return
	}
}

// 1. Creates your first command. This example shows an 'order' command with a required argument
// called 'product' and an optional argument called 'option'.
program
	.command('switch')
	.description('Default behavior. List the existing configuration and help select one. Equivalent to `npx switch-cloud`') // Optional description
	.action(switchCmd)

// 2. Deals with cases where no command is passed.
if (process.argv.length == 2)
	process.argv.push('switch')

// 3. Starts the commander program
program.parse(process.argv) 






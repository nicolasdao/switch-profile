#!/usr/bin/env node

// NOTE: The official inquirer documentation is really good. To know more about the different question types,
// please refer to https://www.npmjs.com/package/inquirer#prompt-types

const program = require('commander')
const inquirer = require('inquirer')
const { EOL } = require('os')
const { listProfiles, getCredentials, getDefaultProfile, updateDefaultProfile, deleteProfiles, createProfile, regions, createSsoProfile } = require('./src/aws')
const { printAWSerrors } = require('./src/core')
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

const switchCmd = async () => {
	const [defaultProfileErrors, defaultProfile] = await getDefaultProfile()
	if (defaultProfileErrors)
		return printAWSerrors([new Error('Fail to get default profile'), ...defaultProfileErrors])

	const defaultProfileName = defaultProfile && defaultProfile.profile ? defaultProfile.profile : ''
	let defaultProfileExpired = false
	if (defaultProfileName) {
		const expiryDate = defaultProfile.expiry_date ? new Date(defaultProfile.expiry_date) : null
		const messages = [EOL,`Current default profile: ${defaultProfileName.bold}`.cyan]
		if (expiryDate) {
			const exp = expiryDate.getTime()
			const now = Date.now()
			if (now > exp) {
				defaultProfileExpired = true
				messages.push(' WARNING: Expired'.yellow)
			} else if (now+2*60*1000 > exp)
				messages.push(' WARNING: Expires in less than 2 minutes'.yellow)
			else {
				const timeLeftInMin = ((exp-now)/60000).toFixed(2)
				messages.push(` INFO: This profile expires in ${timeLeftInMin} minutes`.cyan)
			}
		}
		messages.push(EOL)
		console.log(messages.join(''))
	} else 
		console.log(`${EOL}Current default profile: ${'unknown'.bold} (pick one up in the list below and we'll remember next time)${EOL}`.cyan)

	const [listErrors, profiles] = await listProfiles()
	if (listErrors)
		return printAWSerrors([new Error('Fail to list profiles'), ...listErrors])

	const profileCount = profiles.length
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
					...(defaultProfileExpired ? [{ name: `Refresh default profile ${defaultProfileName.bold}` ,value:'refresh' }] : []),
					{ name: 'Create profile', value:'new' }, 
					{ name: 'Delete profiles', value:'delete' },
					{ name: 'Abort', value:ABORT_KEY }
				]
			}
		])

		if (option == 'refresh')
			await setProfileToDefault(defaultProfileName, profiles, `AWS profile ${defaultProfileName.bold} successfully refreshed.`)
		else if (option == 'delete') {
			const { delProfiles } = await inquirer.prompt([
				{ 
					type: 'checkbox', 
					name: 'delProfiles', 
					message: 'Select the profiles you which to delete: ',
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
					message: `Are you sure you want to delete ${labelText}?`,
				}
			])

			if (!delConfirm)
				return 

			if (defaultProfileName && delProfiles.some(p => p == defaultProfileName))
				return printAWSerrors([new Error(`Fail to delete ${label}. Profile ${defaultProfileName.bold} is the current default. Set another profile as the default, then try deleting again.`)], { noStack:true })

			const [delErrors] = await deleteProfiles(delProfiles)
			if (delErrors)
				return printAWSerrors([new Error(`Fail to delete ${label}`), ...delErrors])

			console.log(`AWS profile${delProfiles.length > 1 ? 's' : ''} successfully deleted.`.green)
		} else if (option == 'new') {
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
			} else
				await createSsoProfile(name)

			console.log(`New profile ${name.bold} successfully created 🚀`.green)

			const { setAsDefault } = await inquirer.prompt([
				{ 
					type: 'confirm', 
					name: 'setAsDefault', 
					message: 'Do you wish to set this new profile as the default?',
				}
			])

			if (!setAsDefault)
				return  

			const [listErrors2, profiles2] = await listProfiles()
			if (listErrors2)
				return printAWSerrors([new Error('Fail to list profiles'), ...listErrors2])

			await setProfileToDefault(name, profiles2)
		} else if (option == ABORT_KEY)
			return

		return 
	} else
		await setProfileToDefault(friendlyName, profiles)
}

const setProfileToDefault = async (profileName, profileList, successMsg) => {
	const profile = profileList.find(p => p.friendlyName == profileName || p.name == profileName)
	// console.log(profile)

	// Gets the AWS credentials for a specific profile. If that profile is an SSO profile, this function has a series of
	// side-effects:
	// 	- If the local SSO session stored under ~/.aws/sso/cache has expired, then it will redirect the user to the SSO portal and eventually refresh that ~/.aws/sso/cache.
	//  - If the local SSO creds stored under ~/.aws/cli/cache have expired (AWS_KEY, AWS_SECRET, AWS_SESSION), then they will be refreshed using the session stored under the ~/.aws/sso/cache.
	const [credsErrors, creds] = await getCredentials(profile.name, profile.sso_start_url)
	if (credsErrors)
		return printAWSerrors([new Error(`Fail to get credentials for profile ${profile.name}`), ...credsErrors])

	// console.log(creds)

	const [errors] = await updateDefaultProfile({
		...creds,
		profile: profile.name
	})

	if (errors)
		return printAWSerrors([new Error('Fail to update the default profile'), ...errors])

	console.log((successMsg || `AWS profile ${profile.name.bold} successfully set up as default.`).green)
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






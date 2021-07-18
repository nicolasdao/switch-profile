#!/usr/bin/env node

// NOTE: The official inquirer documentation is really good. To know more about the different question types,
// please refer to https://www.npmjs.com/package/inquirer#prompt-types

const program = require('commander')
const inquirer = require('inquirer')
const { EOL } = require('os')
const { listProfiles, getCredentials, getDefaultProfile, updateDefaultProfile, deleteProfiles } = require('./src/aws')
const { printAWSerrors } = require('./src/core')
require('colors')
const { version } = require('./package.json')
program.version(version) // This is required is you wish to support the --version option.

const OPTIONS_KEY = '_options_4s2s3a'
const ABORT_KEY = '_abort_rfewq1'

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
					{ name: 'Create a new profile', value:'new' }, 
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
					message: `Select the profiles you which to delete: `,
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
		} else if (option == ABORT_KEY)
			return

		return 
	} else if (option == 'new') {
		
	} else
		await setProfileToDefault(friendlyName, profiles)

	// ])
	// keyPairConfig.cipher = cipher
	// const isRSA = cipher == 'rsa'

	// if (isRSA) {
	//	 const choices = getRsakeyLength()
	//	 const { length } = await inquirer.prompt([
	//		 { type: 'list', name: 'length', message: 'Choose a key length', choices , default:getDefaultChoice(choices, DEFAULT_RSA_KEY_LENGTH) }
	//	 ])
	//	 keyPairConfig.length = length
	// } else if (cipher == 'ec') {
	//	 const choices = getEcCurves()
	//	 const { curve } = await inquirer.prompt([
	//		 { type: 'list', name: 'curve', message: 'Choose an ECDSA curve', choices, default:getDefaultChoice(choices, DEFAULT_EC_CURCE) }
	//	 ])
	//	 keyPairConfig.curve = curve
	// }

	// const { protect } = await inquirer.prompt([
	//	 { type: 'confirm', name: 'protect', message: 'Do you want to protect the private key with a passphrase?', default: false }
	// ]) 

	// if (protect) {
	//	 const { passphrase } = await inquirer.prompt([{ type:'password', name:'passphrase', mask:'*', message:'Enter a passphrase' }])
	//	 keyPairConfig.passphrase = passphrase
	// }		

	// const { formats } = await requiredPrompt(() => inquirer.prompt([
	//	 { type: 'checkbox', name: 'formats', message: 'Choose the output formats', choices:[
	//		 { name:'pem', value:'pem', checked:true }, 
	//		 { name:'jwk', value:'jwk', checked:false }] 
	//	 }
	// ]), 'formats')
	// keyPairConfig.formats = formats

	// const pemSelected = formats.some(f => f == 'pem')
	// const jwkSelected = formats.some(f => f == 'jwk')

	// const { printOrSaveOptions=[] } = await requiredPrompt(() => inquirer.prompt([
	//	 { type: 'checkbox', name: 'printOrSaveOptions', message: 'Choose the output options', choices:[
	//		 { name:'Print in this terminal', value:'print', checked:true },
	//		 { name:'Save to files', value:'save' },
	//		 { name:'Both', value:'both' },
	//	 ] 
	//	 }
	// ]), 'printOrSaveOptions')

	// const printKeys = printOrSaveOptions.some(o => o == 'both' || o == 'print')
	// const saveKeys = printOrSaveOptions.some(o => o == 'both' || o == 'save')
	// const options = { print:printKeys, save:saveKeys }

	// const keypair = new Keypair(keyPairConfig)

	// const showcaseKey = showcaseKeypair(keypair)
	// const showcasePrivateKey = showcaseKey('private')
	// const showcasePublicKey = showcaseKey('public')

	// if (printKeys) console.log('PRIVATE KEY'.green.underline.bold)
	// if (pemSelected) 
	//	 await showcasePrivateKey('PEM', { ...options, file:'private.key' })
	// if (jwkSelected) 
	//	 await showcasePrivateKey('JWK', { ...options, file:'private.json' })

	// if (printKeys) console.log('PUBLIC KEY'.green.underline.bold)
	// if (pemSelected) 
	//	 await showcasePublicKey('PEM', { ...options, file:'public.pem' })
	// if (jwkSelected) 
	//	 await showcasePublicKey('JWK', { ...options, file:'public.json' })

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
		return printAWSerrors([new Error(`Fail to update the default profile`), ...errors])

	console.log((successMsg || `AWS profile ${profile.name.bold} successfully set up as default.`).green)
}

// 1. Creates your first command. This example shows an 'order' command with a required argument
// called 'product' and an optional argument called 'option'.
program
	.command('switch')
	.description('Default behavior. List the existing configuration and help select one. Equivalent to `npx switch-cloud`') // Optional description
	.action(switchCmd)

// program
// 	.command('convert <filepath>')
// 	.alias('cv') // Optional alias
// 	.description('Converts a key file from PEM to JWK(i.e., JSON) or from JWK to PEM. Also support OpenID URL. Example: `npx create-keys cv private.json` or `npx create-keys cv https://accounts.google.com/.well-known/openid-configuration`')
// 	.action(async (filepath) => {
// 		// const isUrl = validate.url(filepath)

// 		// if (isUrl) {
// 		//	 const [errors, result={}] = await listOpenIDpublicKeys(filepath)
// 		//	 if (errors) {
// 		//		 printErrors(errors)
// 		//		 process.exit()
// 		//	 }

// 		//	 const { jwks_uri, data } = result

// 		//	 const isNotArray = !Array.isArray(data.keys)
// 		//	 if (!data.keys ||  isNotArray) {
// 		//		 const msg = isNotArray 
// 		//			 ? `'keys' is expected to be an array of JWK. Found ${typeof(data.keys)} instead`
// 		//			 : 'Could not found the \'keys\' property in the response'
// 		//		 console.log(`WARN: ${msg}. Failed to convert JWK keys to PEM format`.yellow)
// 		//		 console.log(`KEYS at ${jwks_uri}:`.green)
// 		//		 console.log(JSON.stringify(data.keys, null, '  '))
// 		//	 } else if (!data.keys.length) {
// 		//		 console.log(`No public keys found at ${jwks_uri}`.cyan)
// 		//	 } else {
// 		//		 console.log(`Found ${data.keys.length} JWK public key${data.keys.length > 1 ? 's' : ''} at ${jwks_uri}`.cyan)
// 		//		 const { printOrSaveOptions=[] } = await requiredPrompt(() => inquirer.prompt([
// 		//			 { type: 'checkbox', name: 'printOrSaveOptions', message: 'Choose the output options', choices:[
// 		//				 { name:'Print in this terminal', value:'print', checked:true },
// 		//				 { name:'Save to files', value:'save' },
// 		//				 { name:'Both', value:'both' },
// 		//			 ] 
// 		//			 }
// 		//		 ]), 'printOrSaveOptions')

// 		//		 const printKeys = printOrSaveOptions.some(o => o == 'both' || o == 'print')
// 		//		 const saveKeys = printOrSaveOptions.some(o => o == 'both' || o == 'save')
// 		//		 const options = { print:printKeys, save:saveKeys }

// 		//		 for (let jwk of data.keys) {
// 		//			 const showcaseKey = showcaseKeypair(new Key({ jwk }))()
// 		//			 const kid = jwk.kid||'no_kid'
// 		//			 const alg = jwk.alg||'no_alg'
// 		//			 const kty = jwk.kty||'no_kty'
// 		//			 const filename = `${kty}-${alg}-kid_${kid}.pem`.toLowerCase()
// 		//			 await showcaseKey('PEM', { ...options, header: filename , file:filename })
// 		//		 }
// 		//	 }
// 		// } else {
// 		//	 const file = getAbsolutePath(filepath)
// 		//	 const fileExists = await exists(file)
// 		//	 if (!fileExists) {
// 		//		 console.log(`File ${file} not found`.red)
// 		//		 process.exit()
// 		//	 }			

// 		//	 const fileContent = (await read(file)).toString()

// 		//	 let jwkContent 
// 		//	 try {
// 		//		 jwkContent = JSON.parse(fileContent)
// 		//	 } catch(err) {
// 		//		 jwkContent = null
// 		//		 voidFn(err)
// 		//	 }

// 		//	 const keyConfig = jwkContent ? { jwk:jwkContent } : { pem:fileContent }
// 		//	 const [outputFormat, outputFile] = jwkContent ? ['PEM', 'key.pem'] : ['JWK', 'key.json']

// 		//	 const { printOrSaveOptions=[] } = await requiredPrompt(() => inquirer.prompt([
// 		//		 { type: 'checkbox', name: 'printOrSaveOptions', message: 'Choose the output options', choices:[
// 		//			 { name:'Print in this terminal', value:'print', checked:true },
// 		//			 { name:'Save to files', value:'save' },
// 		//			 { name:'Both', value:'both' },
// 		//		 ] 
// 		//		 }
// 		//	 ]), 'printOrSaveOptions')
			
// 		//	 const printKeys = printOrSaveOptions.some(o => o == 'both' || o == 'print')
// 		//	 const saveKeys = printOrSaveOptions.some(o => o == 'both' || o == 'save')
// 		//	 const options = { print:printKeys, save:saveKeys }

// 		//	 const showcaseKey = showcaseKeypair(new Key(keyConfig))()

// 		//	 await showcaseKey(outputFormat, { ...options, file:outputFile })
// 		// }
// 	})

// program
// 	.command('list <url>')
// 	.alias('ls') // Optional alias
// 	.description('List the public keys of an OpenID discovery endpoint. Example: `npx create-keys ls https://accounts.google.com/.well-known/openid-configuration`')
// 	.action(async (url) => {
// 		// const [errors, result={}] = await listOpenIDpublicKeys(url)
// 		// if (errors) {
// 		//	 printErrors(errors)
// 		//	 process.exit()
// 		// }

// 		// const { jwks_uri, data } = result

// 		// console.log(`KEYS at ${jwks_uri}:`.green)
// 		// console.log(JSON.stringify(data, null, '  '))
// 	})


// 2. Deals with cases where no command is passed.
if (process.argv.length == 2)
	process.argv.push('switch')

// 3. Starts the commander program
program.parse(process.argv) 






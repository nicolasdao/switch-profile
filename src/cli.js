/**
 * Command line entry point.
 */
const { Command } = require('commander')
const p = require('@clack/prompts')
const ui = require('./ui')
const log = require('./log')
const { CLI_VERSION } = require('./settings')
const { CancelError } = require('./commands/common')
const commands = require('./commands')

// 'aws configure sso' (driven by 'add') would otherwise end with an unrelated promotional prompt.
process.env.AWS_CLI_AGENT_TOOLKIT_HINT_DISABLED = 'true'

const EXAMPLES = `
Examples:
  $ sp                          pick a profile (type to search)
  $ sp acme-prod                switch straight to a profile
  $ sp acme prod                fuzzy match: switches if only one profile matches
  $ sp login                    log in again now (device code over SSH)
  $ sp add                      import every account of an SSO portal
  $ switch-profile status --json

'sp' is the shortcut switch-profile installs on first use (or from Settings). It also
sets AWS_PROFILE in the current terminal. Without it, use 'npx switch-profile'.

Exit codes: 0 ok · 1 error · 2 login required · 3 bad input · 130 cancelled`

const run = action => async (...args) => {
	const cmd = args[args.length - 1]
	const opts = cmd.optsWithGlobals()
	if (opts.debug)
		process.env.SWITCH_PROFILE_DEBUG = '1'
	try {
		await action(...args.slice(0, -2), opts)
	} catch(err) {
		if (err instanceof CancelError) {
			log.info('cancelled by the user')
			p.cancel(`Cancelled ${ui.unicode ? '👋' : ''}`)
			process.exitCode = 130
			return
		}
		log.error(`${cmd.name()} failed`, err)
		if (opts.json && err instanceof ui.CliError)
			process.stderr.write(JSON.stringify({ error:err.message, hint:err.hint || null, code:err.exitCode }) + '\n')
		else
			ui.printError(err)
		process.exitCode = err.exitCode || 1
	}
}

/**
 * Last line of defence: anything that escapes run() (a crash in an event handler, a rejected promise nobody
 * awaited) is logged and reported instead of dying with a bare stack trace.
 */
const crashed = err => {
	log.error('unexpected crash', err)
	try {
		ui.printError(err instanceof Error ? err : new Error(String(err)))
	} catch {
		console.error(err)
	}
	process.exit(1)
}

const main = argv => {
	log.start({ version:CLI_VERSION, argv })
	process.on('uncaughtException', crashed)
	process.on('unhandledRejection', crashed)
	process.on('exit', code => log.info(`exit ${code}`))
	const program = new Command()
	program
		.name('switch-profile')
		.description('Switch between AWS profiles, log in with SSO, and keep every terminal on the right account.')
		.version(CLI_VERSION, '-v, --version')
		.argument('[profile...]', 'profile name or search text')
		.option('--json', 'machine-readable output')
		.option('--no-input', 'never prompt (fails with a hint instead)')
		.option('--debug', 'show error details')
		.addHelpText('after', EXAMPLES)
		.showSuggestionAfterError()
		.action(run((words, opts) => commands.switch((words || []).join(' '), opts)))

	program.command('use').argument('<profile>').description('switch to a profile by its exact name').action(run(commands.use))
	program.command('status').description('show the current profile and login state').action(run(opts => commands.status([], opts)))
	program.command('login').argument('[profile]', 'defaults to this terminal\'s profile, then the default profile')
		.description('log in again now, even if the session is still valid')
		.option('--device', 'use a device code (approve from any device)')
		.option('--browser', 'use the browser on this machine')
		.action(run(commands.login))
	program.command('logout').description('end every SSO session on this machine').option('-y, --yes', 'do not ask for confirmation').action(run(opts => commands.logout([], opts)))
	program.command('add').description('add profiles: import an SSO portal, or create one')
		.option('--from-sso [session]', 'import (or re-sync) every account and role of an [sso-session]')
		.option('--region <region>', 'default region of imported profiles')
		.option('--prefix <prefix>', 'name prefix of imported profiles')
		.option('--prune', 'remove imported profiles that no longer exist')
		.option('-y, --yes', 'do not ask for confirmation')
		.action(run(opts => commands.add([], opts)))
	program.command('remove').alias('rm').argument('[profiles...]').description('remove profiles').option('-y, --yes', 'do not ask for confirmation').action(run(commands.remove))
	program.command('settings').description('per-terminal switching, login mode and more').action(run(opts => commands.settings([], opts)))
	// 1.x compatibility: 'switch-profile switch'.
	program.command('switch', { hidden:true }).action(run(opts => commands.switch('', opts)))

	return program.parseAsync(argv)
}

module.exports = { main }

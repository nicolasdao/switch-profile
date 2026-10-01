#!/usr/bin/env node

// Checked before anything else is loaded, so old Node versions get a clear message instead of a syntax error.
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 20 || (major == 20 && minor < 12)) {
	console.error(`switch-profile needs Node.js 20.12 or later (you have ${process.versions.node}).\nUpdate Node.js (e.g. with nvm or fnm) and try again.`)
	process.exit(1)
}

// A source checkout runs the sources; the published package runs the bundle.
const { existsSync } = require('fs')
const { join } = require('path')
const entry = existsSync(join(__dirname, 'src', 'cli.js')) && !process.env.SWITCH_PROFILE_DIST ? './src/cli.js' : './dist/cli.js'
require(entry).main(process.argv)

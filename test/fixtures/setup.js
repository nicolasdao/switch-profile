// Loaded by mocha before every suite (.mocharc.json): keeps the diagnostic log (src/log.js) of in-process tests
// out of the real ~/.switch-profile. End-to-end tests (test/cli.js) use a throwaway HOME instead.
const os = require('os')
const { join } = require('path')

process.env.SWITCH_PROFILE_LOG_FILE = join(os.tmpdir(), `switch-profile-test-${process.pid}.log`)
process.on('exit', () => {
	try {
		require('fs').rmSync(process.env.SWITCH_PROFILE_LOG_FILE, { force:true })
	} catch {
		// best effort
	}
})

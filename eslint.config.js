const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
	{ ignores: ['dist/', 'node_modules/', '.claude/', '.agents/'] },
	js.configs.recommended,
	{
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'commonjs',
			globals: { ...globals.node, ...globals.mocha }
		},
		rules: {
			'no-console': 'off',
			indent: ['error', 'tab', { SwitchCase: 1 }],
			'linebreak-style': ['error', 'unix'],
			quotes: ['error', 'single', { avoidEscape: true }],
			semi: ['error', 'never']
		}
	},
	{
		files: ['test/fixtures/**'],
		rules: { 'no-empty': 'off' }
	}
]

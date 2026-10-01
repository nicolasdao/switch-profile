/**
 * Minimal, line-preserving INI helpers for the AWS 'config' and 'credentials' files.
 *
 * Every function is pure: it takes the file content as a string and returns a new string. Lines that
 * are not touched (comments, blank lines, other sections) are kept exactly as they were, which is why
 * this module is line-based rather than a parse/re-serialize round trip.
 */

const HEADER_REGEX = /^\s*\[([^\]]+)\]\s*$/
const KEY_REGEX = /^\s*([^=#;\s][^=]*?)\s*=\s*(.*?)\s*$/

const detectNewline = str => /\r\n/.test(str || '') ? '\r\n' : '\n'

/**
 * Splits the content into blocks. The first block has no header (lines before the first section).
 *
 * @param  {String} str
 * @return {Object} blocks[].name		e.g., 'default', 'profile dev', 'sso-session acme', or null for the preamble
 * @return {Array}  blocks[].lines		Raw lines, header line included
 */
const parse = str => {
	const lines = (str || '').split(/\r?\n/)
	const blocks = [{ name:null, lines:[] }]
	for (const line of lines) {
		const m = line.match(HEADER_REGEX)
		if (m)
			blocks.push({ name:m[1].trim().replace(/\s+/g, ' '), lines:[line] })
		else
			blocks[blocks.length-1].lines.push(line)
	}
	return blocks
}

const stringify = (blocks, newline) => blocks.filter(b => b.lines.length).map(b => b.lines.join(newline)).join(newline)

const findBlock = (blocks, name) => blocks.find(b => b.name === name)

/**
 * Lists the section names in the order they appear.
 */
const listSections = str => parse(str).filter(b => b.name).map(b => b.name)

/**
 * Returns the key/value pairs of a section, in order, or null if the section does not exist.
 *
 * @return {Array} [[key, value], ...]
 */
const getEntries = (str, name) => {
	const block = findBlock(parse(str), name)
	if (!block)
		return null
	return block.lines.slice(1).map(l => l.match(KEY_REGEX)).filter(Boolean).map(m => [m[1], m[2]])
}

/**
 * Same as getEntries but returns an object.
 */
const getSection = (str, name) => {
	const entries = getEntries(str, name)
	return entries ? entries.reduce((acc, [k,v]) => { acc[k] = v; return acc }, {}) : null
}

const toLines = (name, entries) => [`[${name}]`, ...entries.map(([k,v]) => `${k} = ${v}`)]

/**
 * Replaces a section's whole body with the given entries, or creates it if missing.
 *
 * @param  {String}  str
 * @param  {String}  name
 * @param  {Array}   entries				[[key, value], ...]
 * @param  {String}  options.position	'top' or 'end' (default). Only used when the section is created.
 * @return {String}
 */
const setSection = (str, name, entries, options) => {
	const newline = detectNewline(str)
	const blocks = parse(str)
	const block = findBlock(blocks, name)
	const lines = toLines(name, entries)
	if (block) {
		block.lines = [...lines, '']
		return tidy(stringify(blocks, newline), newline)
	}

	const { position } = options || {}
	const content = (str || '').trim()
	if (!content)
		return lines.join(newline) + newline
	if (position == 'top')
		return lines.join(newline) + newline + newline + content + newline
	return content + newline + newline + lines.join(newline) + newline
}

/**
 * Removes a section (header and body).
 */
const removeSection = (str, name) => {
	const blocks = parse(str)
	if (!findBlock(blocks, name))
		return str
	const newline = detectNewline(str)
	return tidy(stringify(blocks.filter(b => b.name !== name), newline), newline)
}

/**
 * Sets or deletes individual keys in an existing section, leaving every other line untouched. New keys
 * are appended at the end of the section. A null/undefined value deletes the key.
 *
 * @param  {String} str
 * @param  {String} name
 * @param  {Object} changes		{ key: value|null }
 * @return {String}				Unchanged if the section does not exist.
 */
const setKeys = (str, name, changes) => {
	const blocks = parse(str)
	const block = findBlock(blocks, name)
	if (!block)
		return str

	const newline = detectNewline(str)
	const pending = { ...changes }
	const body = []
	for (const line of block.lines.slice(1)) {
		const m = line.match(KEY_REGEX)
		if (m && m[1] in pending) {
			const value = pending[m[1]]
			delete pending[m[1]]
			if (value !== null && value !== undefined)
				body.push(`${m[1]} = ${value}`)
			continue
		}
		body.push(line)
	}

	// Insert new keys before the trailing blank lines of the section.
	let insertAt = body.length
	while (insertAt > 0 && !body[insertAt-1].trim())
		insertAt--
	const added = Object.keys(pending).filter(k => pending[k] !== null && pending[k] !== undefined).map(k => `${k} = ${pending[k]}`)
	body.splice(insertAt, 0, ...added)

	block.lines = [block.lines[0], ...body]
	return stringify(blocks, newline)
}

// Collapses runs of 3+ newlines created by section edits and guarantees a single trailing newline.
const tidy = (str, newline) => {
	const collapsed = str.split(/\r?\n/).reduce((acc, line) => {
		if (!line.trim() && acc.length && !acc[acc.length-1].trim())
			return acc
		acc.push(line)
		return acc
	}, [])
	while (collapsed.length && !collapsed[0].trim())
		collapsed.shift()
	while (collapsed.length && !collapsed[collapsed.length-1].trim())
		collapsed.pop()
	return collapsed.length ? collapsed.join(newline) + newline : ''
}

module.exports = {
	parse,
	listSections,
	getEntries,
	getSection,
	setSection,
	removeSection,
	setKeys
}

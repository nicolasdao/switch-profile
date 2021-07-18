
/**
 * Copyright (c) 2017-2020, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license.
*/

// npm i rimraf fast-glob core-async mime-types archiver tar-stream convert-stream
const { co } = require('core-async')
const fs = require('fs')
const { join, resolve } = require('path')
const rimraf = require('rimraf')
const fg = require('fast-glob')
const mime = require('mime-types')
const archiver = require('archiver')
const tar = require('tar-stream')
const { toBuffer } = require('convert-stream')
const { Writable } = require('stream')

/**
 * Checks if a file or folder exists
 * 
 * @param  {String}  filePath 	Absolute path to file or folder on the local machine
 * @return {Boolean}   
 */
const fileExists = filePath => new Promise(onSuccess => fs.exists(filePath, yes => onSuccess(yes ? true : false)))

/**
 * Creates a folder. 
 * 
 * @param  {String} folderPath Absolute folder path on the local machine
 * @return {Object}   
 */
const createFolder = folderPath => new Promise((onSuccess, onFailure) => fs.mkdir(folderPath, err => {
	if (!err || (err.message || '').indexOf('file already exists') >= 0)
		onSuccess(folderPath)
	else
		onFailure(err)
}))

/**
 * Deletes a folder. 
 * 
 * @param  {String} folderPath 		Absolute folder path on the local machine
 * @return {Void} 
 */
const deleteFolder = folderPath => new Promise(onSuccess => rimraf(folderPath, () => onSuccess()))

/**
 * Deletes a file.
 * 
 * @param  {String}  filePath 	Absolute file path on the local machine
 * @return {Void}
 */
const deleteFile = filePath => new Promise((onSuccess, onFailure) => fs.unlink(filePath, err => err ? onFailure(err) : onSuccess()))

/**
 * Creates file or update file located under 'filePath'. 
 * 
 * @param  {String}  filePath 			Absolute file path on the local machine
 * @param  {Object}  content 			File content
 * @param  {Boolean} options.append 	Default false. If true, this function appends rather than overrides.
 * @param  {String}  options.appendSep 	Default '\n'. That the string used to separate appended content. This option is only
 *                                     	active when 'options.append' is set to true.
 * @return {Void}                	
 */
const writeToFile = (filePath, content, options) => new Promise((onSuccess, onFailure) => {
	content = content || ''
	const { append, appendSep='\n' } = options || {}
	const stringContent = (typeof(content) == 'string' || content instanceof Buffer) ? content : JSON.stringify(content, null, '  ')
	const fn = append ? fs.appendFile : fs.writeFile
	fn(filePath, append ? `${stringContent}${appendSep}` : stringContent, err => err ? onFailure(err) : onSuccess())
})

/**
 * Creates folders under a rootFolder
 * 
 * @param  {String}  rootFolder 					Root folder. This folder must exist prior to calling this function.
 * @param  {Array}   folders    					Array of folders so that the path of the last item in that array will be: 
 *                                   				rootFolder/folders[0]/folders[1]/.../folders[n]
 * @param  {Object}  options
 * @param  {Boolean} options.deletePreviousContent  If set to true, this will delete the content of the existing folder
 * @return {String} 								Path of the latest folder:
 *                               					rootFolder/folders[0]/folders[1]/.../folders[n]           
 */
const createFolders = (rootFolder, folders=[], options={}) => co(function *() {
	const { deletePreviousContent } = options
	if (!rootFolder)
		throw new Error('\'rootFolder\' is required.')
	const rootExists = yield fileExists(rootFolder)
	if (!rootExists)
		throw new Error(`Root folder ${rootFolder} does not exist.`)

	yield folders.reduce((processPrevious, f) => co(function *(){
		const rootPath = yield processPrevious
		const folderPath = join(rootPath, f)
		const folderExists = yield fileExists(folderPath)
		if (folderExists && deletePreviousContent) 
			yield deleteFolder(folderPath)
		else if (!folderExists)
			yield createFolder(folderPath)
		return folderPath
	}), Promise.resolve(rootFolder))
})

/**
 * Gets a file under a Google Cloud Storage's 'filePath'.
 * 
 * @param  {String}  filePath 	Absolute file path on the local machine
 * @return {Buffer}
 */
const readFile = filePath => new Promise((onSuccess, onFailure) => fs.readFile(filePath, (err, data) => err ? onFailure(err) : onSuccess(data)))

//
// Gets an array of absolute file paths located under the 'folderPath', or a Channel that streams those files.
// 
// @param  {String}				folderPath			Absolute path to folder
// @param  {String|[String]}	options.pattern 	Default is '*.*' which means all immediate files. To get all the files
//													use '**/*.*'
// @param  {String|[String]}	options.ignore		e.g., '**/node_modules/**'
// @param  {Channel}			options.channel		When a channel is passed, all files are streamed to that channel instead of 
// 													being returned as an array. The last file found add a specific string on 
// 													the channel to indicates that the scan is over. That string value is: 'end'.
// @return {[String]}         						If a channel is passed via 'options.channel', than the output is null and 
// 													the files are streamed to that channel.
//
const listFiles = (folderPath='', options={}) => co(function *(){
	const pattern = options.pattern || '*.*'
	const ignore = options.ignore
	const channel = options.channel
	const patterns = (typeof(pattern) == 'string' ? [pattern] : pattern).map(p => join(folderPath, p))
	const opts = ignore ? { ignore:(typeof(ignore) == 'string' ? [ignore] : ignore).map(p => join(folderPath, p)) } : {}

	if (!channel)
		return yield fg(patterns,opts)
	else {
		const stream = fg.stream(patterns,opts)
		stream.on('data', data => {
			channel.put(data)
		})
		stream.on('end', () => {
			channel.put('end')
			stream.destroy()
		})
		stream.on('error', err => {
			console.log(`An error happened while streaming files from ${folderPath}: ${err}`)
			stream.destroy()
		})

		return null
	}
})

/**
 * Gets the absolute path. If not input is passed, it returns the current working directory. Supports both Windows and Unix OSes. 
 * 
 * @param  {String} somePath Some absolute or relative file or folder path.
 * @return {String}          Absolute path
 */
const getAbsolutePath = somePath => {
	if (!somePath)
		return process.cwd()
	else if (somePath.match(/^\./)) 
		return resolve(somePath)
	else if (somePath.match(/^(\\|\/|~)/)) 
		return somePath
	else if (typeof(somePath) == 'string')
		return resolve(somePath)
	else
		throw new Error(`Invalid path ${somePath}`)
}

/**
 * Gets a JSON object loacted under 'filePath'. This method is an alternative to 'require(filePath)' which caches results and prevents
 * to get access to a refreshed version of the JSON file. 
 * 
 * @param  {String} filePath			Absolute path to the JSON file. 
 * @param  {String} defaultValue		Default is {}
 * 
 * @return {Object}          			JSON Object
 */
const getJSON = (filePath, defaultValue={}) => readFile(filePath).then(text => {
	if (!text || !text.length)
		return defaultValue

	try {
		return JSON.parse(text.toString()) || defaultValue
	} catch(e) {
		return (() => ({}))(e)
	}
})

const _isFolder = folderPath => new Promise(resolve => fs.stat(folderPath, (err,data) => resolve(err || !data || !data.isDirectory ? false : data.isDirectory())))
const _readdir = folderPath => new Promise(resolve => fs.readdir(folderPath, (err,data) => resolve(err || !data ? [] : data)))
const _rmdir = folderPath => new Promise(resolve => fs.rmdir(folderPath, resolve))

/**
 * Deletes all the empty folders(incl. 'rootFolder') under 'rootFolder'. 
 * 
 * @param {String} rootFolder 	Absolute path to folder. 
 * @yield {Void}   
 */
const deleteEmptyFolders = rootFolder => co(function *(){
	const isDir = yield _isFolder(rootFolder)
	if (!isDir) 
		return

	let files = yield _readdir(rootFolder)
	yield files.map(file => co(function *(){
		const fullPath = join(rootFolder, file)
		yield deleteEmptyFolders(fullPath)
	}))

	// re-evaluate files; after deleting subfolder
	// we may have parent folder empty now
	if (files.length > 0)
		files = yield _readdir(rootFolder)

	if (files.length == 0) 
		yield _rmdir(rootFolder)
})

/**
 * Gets the mime type associated with a file extension. 
 *
 * @param {String}		fileOrExt	e.g., 'json', '.md', 'file.html', 'folder/file.js', 'data:image/png;base64,....'
 * @return {String}					e.g., 'application/json', 'text/markdown', 'text/html', 'application/javascript'
 */
const getMimeType = fileOrExt => {
	if (!fileOrExt)
		return ''
	
	// Test if 'fileOrExt' is a data URI
	if (/^data:(.*?),/.test(fileOrExt)) 
		return (fileOrExt.match(/^data:(.*?);/, '') || [])[1] || ''
	
	return mime.lookup(fileOrExt) || ''
}

/**
 * Gets the content type associated with a file extension. 
 *
 * @param {String}		fileOrExt	e.g., 'json', '.md', 'file.html', 'folder/file.js'
 * @return {String}					e.g., 'application/json; charset=utf-8', 'text/x-markdown; charset=utf-8', 'text/html; charset=utf-8'
 */
const getContentType = fileOrExt => !fileOrExt ? '' : (mime.contentType(fileOrExt) || '')

/**
 * Gets the a file's extension or the file extension associated with a mime type.
 *
 * @param {String}		mimeType	e.g., 'application/json', 'text/x-markdown', 'hello.pdf'
 * @return {String}					e.g., 'json', 'md', 'pdf'
 */
const getExt = fileOrMimeType => {
	if (!fileOrMimeType)
		return ''
	
	const t = fileOrMimeType.split('.')
	const [ext] = t[1] ? t.slice(-1) : [null]
	let x
	if (!ext && fileOrMimeType.indexOf('/') >= 0)
		x = mime.extension(fileOrMimeType) || ''
	else
		x = ext

	return x == 'document' ? 'doc' : x
}

/**
 * Get 
 * 
 * @param  {String} mimeType 		e.g., 'image/png'
 * @return {String} output.type     e.g., 'image'     
 * @return {String} output.type     e.g., 'png'     
 */
const getFileType = mimeType => {
	if (!mimeType)
		throw new Error('Missing required argument \'mimeType\'.')

	const [type,subType] = mimeType.split('/')

	return {
		type,
		subType
	}
}

/**
 * Formats file name to make sure it contains a name and an extension.
 * 
 * @param  {String} mimeType    		e.g., 'application/json'
 * @param  {String} fileName    		e.g., 'blob' or null
 * @param  {String} defaultName 		e.g., '12345' (if the value contains an extension, that extension overides the 'mimeType').
 * 
 * @return {String}	output.fileName		e.g., 'blob.json' or '12345.json'
 * @return {String}	output.mimeType		e.g., 'application/json'
 */
const getCanonicalFile = ({ mimeType, fileName, defaultName }) => {
	if (!fileName && !defaultName)
		throw new Error('Missing required argument. When \'fileName\' is not specified, \'defaultName\' is required.')

	const _fileName = fileName || defaultName
	const fileExt = getExt(_fileName)

	if (fileExt) {
		const _mimeType = getMimeType(_fileName) || mimeType
		if (!_mimeType)
			throw new Error(`Failed to determine the mime type for file ${_fileName}.`)

		return { ...getFileType(_mimeType), fileName: _fileName, mimeType:_mimeType }
	}

	if (!mimeType)
		throw new Error('Missing required argument. When \'fileName\' and \'defaultName\' don\'t contain an extension, \'mimeType\' is required.')

	const mimeExt = getExt(mimeType)
	if (!mimeExt)
		throw new Error(`Failed to determine the extension of mime type ${mimeType}.`)

	return { ...getFileType(mimeType), fileName:`${_fileName}.${mimeExt}`, mimeType }
}
	
/**
 * Changes the file extension based on the mime type.
 * 
 * @param  {String} fileName 		e.g., 'hello.jpeg'
 * @param  {String} mimeType		e.g., 'image/png'
 * @return {String}					e.g., 'hello.png'
 */
const changeFileExt = (fileName, mimeType) => {
	if (!fileName || !mimeType)
		return fileName

	let mimeExt = getExt(mimeType)
	if (!mimeExt)
		throw new Error(`Failed to determine the extension of mime type ${mimeType}.`)
	mimeExt = mimeExt == 'document' ? 'doc' : mimeExt

	return fileName.indexOf('.') < 0 ? `${fileName}.${mimeExt}` : fileName.replace(/\.(.*?)$/, `.${mimeExt}`)
}

/**
 * Zips a folder into a buffer using zip (default) or tar.
 * 
 * @param  {String}  src			Folder's absolute path on local machine.
 * @param  {String} options.type	Default 'zip'. Valid values are: 'zip', 'tar'
 * @return {Buffer}						
 */
const zipToBuffer = (src, options) => co(function *(){
	const result = yield fileExists(src)	

	if (!result)
		throw new Error(`Failed to zip folder ${src}. This folder does not exist.`)

	const { type='zip' } = options || {}

	if (type == 'zip') {
		const archive = archiver('zip', { zlib: { level: 6 } }) // this goes from 1 (minimum compression) to 9 (default 6). The higher the compression, the longer it takes to zip and unzip.
		const getBuffer = toBuffer(archive)

		archive.on('warning', err => {
			console.log('Warning while creating zip file', err)
		})

		archive.on('error', err => {
			throw err
		})

		archive.directory(src, '/')
		archive.finalize()

		const buffer = yield getBuffer
		
		return buffer
	} else if (type == 'tar') {
		const files = yield listFiles(src, { pattern:'**/*.*' })
		const data = yield files.map(file => readFile(file, { encoding:null }).then(content => ({
			file,
			relFile: file.replace(src,''),
			content
		})))

		const pack = tar.pack()
		data.forEach(({ relFile, content }) => pack.entry({ name:relFile }, content))
		const chunks = []
		const writeStream = new Writable({
			write(chunk, encoding, callback) {
				chunks.push(chunk)
				callback()
			}
		})

		pack.pipe(writeStream)
		pack.finalize()

		yield new Promise((success) => pack.on('end', success))

		const buffer = Buffer.concat(chunks)

		return buffer
	} else 
		throw new Error(`Unsupported zip type ${type}. Valid zip types: 'zip', 'tar'`)
}).catch(e => {
	console.log(`Failed to zip folder ${src}`)
	throw e
})

module.exports = {
	list: listFiles,
	json: {
		'get': getJSON,
		write: (filePath, obj) => writeToFile(filePath, obj)
	},
	read: readFile,
	write: writeToFile,
	exists: fileExists,
	delete: deleteFile,
	getAbsolutePath,
	folder: {
		create: createFolder,
		createMany: createFolders,
		delete: deleteFolder,
		deleteEmpties: deleteEmptyFolders
	},
	getMimeType,
	getContentType,
	getExt,
	getCanonicalFile,
	changeFileExt,
	getFileType,
	zipToBuffer
}
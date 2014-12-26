var _ 				= require('underscore');
var q 				= require('q');
var temp 			= require('temp').track();
var spawn 			= require('child_process').spawn;
var path 			= require('path');
var ncp 			= require('ncp');
var fs 				= require('fs.extra');
var request 		= require('request');
var parseURL 		= require('url');
var promiseYouTry 	= require('./promise-you-try');
var seqid			= require('./seqid');

function copyDirectoryContents(src, dst) {
	var d = q.defer();

	ncp(src, dst, function (err) {
		if (err) {
			d.reject(err);
		} else {
			d.resolve();
		}
	});

	return d.promise;
}

function writeExtensionSettings(extensionSettings, settingsPath) {
	var d = q.defer();

	var settings = 'var browsercontrol = ' + JSON.stringify(extensionSettings) + ';';

	fs.writeFile(settingsPath, settings, function(err) {
		if (err) {
			d.reject(err);
		} else {
			d.resolve();
		}
	});

	return d.promise;
}

function writeExtensionManifest(serverAddress, manifestPath) {
	var d = q.defer();

	var manifest = {
		manifest_version: 2,

		name: "Chrome Browsercontrol",
		description: "This extension should control the Chrome browser for fun and profit.",
		version: "0.0.1",
		background: {
			page: "chrome-browsercontrol.html"
		},
		content_scripts: [{
			matches: ["<all_urls>"],
			js: ["jquery-2.1.3.min.js", "errors.js", "dom-accessor.js"]
		}],
		permissions: ["tabs", "http://" + parseURL.parse(serverAddress).hostname + "/"]
	};

	fs.writeFile(manifestPath, JSON.stringify(manifest), function(err) {
		if (err) {
			d.reject(err);
		} else {
			d.resolve();
		}
	});

	return d.promise;
}

function writeExtensionSocketIoClient(serverAddress, path) {
	var d = q.defer();

	var url = serverAddress + '/socket.io/socket.io.js';

	request(url, function (err) {
		if (err) {
			d.reject(err);
		} else {
			d.resolve();
		}
	}).pipe(fs.createWriteStream(path));

	return d.promise;
}

function start(options, eventEmitter, serverAddress, sessions)
{
	options = _.defaults(options, {
		requiredCapabilities: {
			browserName: 'chrome'
		},
		desiredCapabilities: {

		}
	});

	var browserName = options.requiredCapabilities.browserName;

	var d = q.defer();

	temp.mkdir('browsercontrol_' + browserName, function (err, profileDirectory) {
		if (err) {
			d.reject(err);
		} else {
			var startUpResolverEventName = seqid.get('BrowserStarted');

			var defaultProfile = path.join(__dirname, '..', 'fixtures', 'chrome', 'default-profile');
			var sourceExtensionPath = path.join(__dirname, '..', 'plugins', 'chrome', 'chrome-browsercontrol');
			var extensionPath = path.join(profileDirectory, 'chrome-browsercontrol');

			copyDirectoryContents(defaultProfile, profileDirectory)
			.then(function () {
				return copyDirectoryContents(sourceExtensionPath, extensionPath);
			})
			.then(function () {
				return q.all([
					writeExtensionSettings({
						serverAddress: serverAddress,
						startUpResolverEventName: startUpResolverEventName
					}, path.join(extensionPath, 'chrome-browsercontrol-settings.js')),
					writeExtensionManifest(serverAddress, path.join(extensionPath, 'manifest.json')),
					writeExtensionSocketIoClient(serverAddress, path.join(extensionPath, 'socket.io.js'))
				]);
			})
			.then(function () {
				var child = spawn('google-chrome', [
					'--user-data-dir=' + profileDirectory,
					'--load-extension=' + extensionPath,
					serverAddress
				]);

				eventEmitter.on(startUpResolverEventName, function (eventData) {
					d.resolve(sessions.create({
						socket: eventData.socket,
						destroy: function () {
							child.kill();
							return promiseYouTry(function () {
								var d = q.defer();

								fs.rmrf(profileDirectory, function (err) {
									if (err) {
										d.reject(err);
									} else {
										d.resolve();
									}
								});

								return d.promise;
							});
						},
						capabilities: _.extend(eventData.capabilities || {}, {
							browserName: 'chrome'
						})
					}));
				});
			}).fail(d.reject);
		}
	});


	return d.promise;
}

exports.start = start;

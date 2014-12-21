var q = require('q');
var temp = require('temp').track();
var spawn = require('child_process').spawn;
var path = require('path');
var ncp = require('ncp');
var fs = require('fs.extra');
var request = require('request');
var parseURL = require('url');
var sessionQueue = require('./session-queue');
var promiseYouTry = require('./promise-you-try');

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

function writeExtensionSettings(serverAddress, settingsPath) {
	var d = q.defer();

	var settings = 'var browsercontrol = ' + JSON.stringify({
		'serverAddress': serverAddress
	}) + ';';

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

function start(options)
{
	var serverAddress = options.serverAddress;

	var browserName = options.requiredCapabilities.browserName || options.desiredCapabilities.browserName || 'chrome';

	var d = q.defer();

	temp.mkdir('browsercontrol_' + browserName, function (err, profileDirectory) {
		if (err) {
			d.reject(err);
		} else {

			var defaultProfile = path.join(__dirname, '..', 'fixtures', 'chrome', 'default-profile');
			
			var sourceExtensionPath = path.join(__dirname, '..', 'plugins', 'chrome', 'chrome-browsercontrol');
			var extensionPath = path.join(profileDirectory, 'chrome-browsercontrol');
			var settingsPath = path.join(extensionPath, 'chrome-browsercontrol-settings.js');
			var manifestPath = path.join(extensionPath, 'manifest.json');
			var socketIOPath = path.join(extensionPath, 'socket.io.js');

			copyDirectoryContents(defaultProfile, profileDirectory)
			.then(function () {
				return copyDirectoryContents(sourceExtensionPath, extensionPath);
			})
			.then(function () {
				return writeExtensionSettings(serverAddress, settingsPath);
			})
			.then(function () {
				return writeExtensionManifest(serverAddress, manifestPath);
			})
			.then(function () {
				return writeExtensionSocketIoClient(serverAddress, socketIOPath);
			})
			.then(function () {
				var child = spawn('google-chrome', [
					'--user-data-dir=' + profileDirectory,
					'--load-extension=' + extensionPath,
					serverAddress
				]);

				sessionQueue.add(function (sessionId) {
					d.resolve({
						browserName: browserName,
						sessionId: sessionId
					});
				}, function () {
					child.kill();
					promiseYouTry(function () {
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
				});

			}).fail(d.reject);
		}
	});


	return d.promise;
}

exports.start = start;
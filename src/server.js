var express = require('express');
var http = require('http');
var socket_io = require('socket.io');
var q = require('q');
var _ = require('underscore');
var bodyParser = require('body-parser');

var sessionQueue = require('./session-queue');
var routes = require('./routes');

var app = express();

app.use(bodyParser.json());

var server = http.createServer(app);
var io = socket_io(server);

var sessionId = 0;
var sessions = {};

io.on('connection', function (socket) {
	
	++sessionId;	
	var sess = sessionQueue.shift();
	sess.onCreated(sessionId);

	socket.on('disconnect', (function (sessionId) {
		return function () {
			sess.onDestroyed();
			delete sessions[sessionId];
		};
	})(sessionId));

	sessions[sessionId] = {
		socket: socket
	};
});

var serverAddress;

function start (port) {

	var d = q.defer();

	try {
		server.listen(port, function () {
			var host = server.address().address;
			var port = server.address().port;

			if (host === '0.0.0.0') {
				host = '127.0.0.1';
			}
			
			serverAddress = 'http://' + host + ':' + port;
			routes.setup(app, serverAddress);


			console.log('Browser Control listening at %s', serverAddress);

			d.resolve(serverAddress);
		});
	} catch (e) {
		d.reject(e);
	}

	return d.promise;
}

function stop() {
	var d = q.defer();

	_.each(sessions, function (session) {
		session.socket.disconnect();
	});

	io.close();

	d.resolve();

	return d.promise;
}

exports.start = start;
exports.stop = stop;
exports.getAddress = function () {
	return serverAddress;
};




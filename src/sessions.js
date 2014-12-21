var q = require('q');
var _ = require('underscore');

var sessionsCount = 0;

var sessions = {};

function create (callback) {
	var d = q.defer();

	++sessionsCount;

	var session = callback(sessionsCount);

	sessions[sessionsCount] = session;

	d.resolve(sessionsCount);

	return d.promise;
}

function destroy (sessionId) {
	var session = sessions[sessionId];
	session.socket.disconnect();

	delete sessions[sessionId];

	return q(session.onDestroyed());
}

function execute (sessionId, command, payload) {
	var d = q.defer();

	var session = sessions[sessionId];
	var socket = session.socket;

	if (!session.queue) {
		session.queue = {};
	}

	if (!session.queue[command]) {
		session.queue[command] = {id: 0, seq: {}};

		socket.on(command, function (data) {
			console.log(command, data);
			session.queue[command].seq[data.id].resolve(data.payload);
			delete session.queue[command].seq[data.id];
		});
	}

	var data = {
		id: ++session.queue[command].id,
		payload: payload
	};

	session.queue[command].seq[data.id] = d;

	socket.emit(command, data);

	return d.promise;
}

function setURL (sessionId, url) {
	return execute(sessionId, 'setURL', url);
}

function getURL (sessionId) {
	return execute(sessionId, 'getURL');
}

exports.create = create;
exports.destroy = destroy;
exports.setURL = setURL;
exports.getURL = getURL;

exports.destroyAll = function () {
	return(q.all(_.map(sessions, function (session, sessionId) {
		return destroy(sessionId);
	})));
};

exports.get = function (sessionId) {
	return sessions[sessionId];
};

exports.getAllCapabilities = function () {
	return _.map(sessions, function (session, sessionId) {
		return {
			id: sessionId,
			capabilities: _.clone(session.actualCapabilities)
		};
	});
};

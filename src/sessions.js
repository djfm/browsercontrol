var q = require('q');
var _ = require('underscore');

var sessionsCount = 0;

var sessions = {};

function create(callback) {
	var d = q.defer();

	++sessionsCount;

	sessions[sessionsCount] = callback(sessionsCount);

	d.resolve(sessionsCount);

	return d.promise;
}

function destroy(sessionId) {
	var session = sessions[sessionId];
	session.socket.disconnect();

	delete sessions[sessionId];

	return q(session.onDestroyed());
}

exports.create = create;
exports.destroy = destroy;

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
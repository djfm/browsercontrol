var _ = require('underscore');
var q = require('q');

module.exports = function () {

    var sessions = {};
    var maxId = 0;

    function sessionExecute (sessionId, command, payload) {
        if (!_.has(sessions, sessionId)) {
            return q.reject(new Error('No such session.'));
        }

        var d = q.defer();

        var session = sessions[sessionId];
        var socket = session.socket;

        if (!session.queue) {
            session.queue = {};
        }

        if (!session.queue[command]) {
            session.queue[command] = {id: 0, seq: {}};
            socket.on(command, function (data) {
                // console.log(command, data);
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

        //console.log(command, data);

        return d.promise;
    }

    function create (data) {
        var id = ++maxId;
        sessions[id] = data;

        sessions[id].socket.on('debugMessage', function (data) {
            console.log('DEBUG', data);
        });

        return {
            sessionId: id
        };
    }

    function destroyAll () {
        return q.all(_.map(sessions, function (session) {
            return session.destroy();
        }));
    }

    function destroy (sessionId) {
        if (_.has(sessions, sessionId)) {
            return sessions[sessionId].destroy();
        } else {
            return q.reject(new Error('No such Session.'));
        }
    }

    function getCapabilities (sessionId) {
        if (_.has(sessions, sessionId)) {
            return q(sessions[sessionId].capabilities);
        } else {
            return q.reject(new Error('No such Session.'));
        }
    }

    function list () {
        return q(_.map(sessions, function (session, id) {
            return {
                id: id,
                capabilities: _.clone(session.capabilities)
            };
        }));
    }

    var methods = {
        create: create,
        destroyAll: destroyAll,
        destroy: destroy,
        getCapabilities: getCapabilities,
        list: list
    };

    /**
     * All methods below need to communicate with the browser,
     * they do so using the socket attached to the session,
     * and correct ordering of the request / responses is ensured
     * by the sessionExecute methods, which wraps all the
     * extensionMethods.
     */

    var extensionMethods = [
        'getURL',
        'setURL',
        'getTitle',
        'getSource',
        'findElement',
        'findActiveElement',
        'findElements',
        'describeElement',
        'getElementInfo',
        'clickElement',
        'setTimeouts',
        'getTimeouts',
        'executeScript',
        'getWindowHandle',
        'getWindowHandles'
    ];

    _.each(extensionMethods, function (method) {
        methods[method] = function (sessionId, data) {
            return sessionExecute(sessionId, method, data);
        };
    });

    return methods;
};

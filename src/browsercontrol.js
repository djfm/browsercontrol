var _               = require('underscore');
var q               = require('q');
var routes          = require('./routes');
var server          = require('./server');
var EventEmitter    = require('events').EventEmitter;

function setup (browsercontrol, serverHandle) {

    var sessions = require('./sessions')();

    var eventEmitter = new EventEmitter();

    browsercontrol.getServerAddress = function () {
        return serverHandle.serverAddress;
    };

    serverHandle.beforeStop = function () {
        return sessions.destroyAll();
    };

    browsercontrol.stop = function () {
        return serverHandle.stop();
    };

    serverHandle.onConnection = function (socket) {
        socket.on('emitEvent', function (eventName) {
            eventEmitter.emit(eventName, {
                socket: socket
            });
        });
    };

    var app                 = _.pick(serverHandle, 'get', 'post', 'put', 'delete');
    app.getServerAddress    = browsercontrol.getServerAddress;

    routes.setup(app, eventEmitter, sessions);
}

function start (port) {
    var d = q.defer();
    var browsercontrol = {};

    server.start(port).then(function (serverHandle) {
        setup(browsercontrol, serverHandle);
        d.resolve(browsercontrol);
    }).fail(d.reject);

    return d.promise;
}

exports.start = start;

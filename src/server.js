var bodyParser  = require('body-parser');
var http        = require('http');
var express     = require('express');
var q           = require('q');
var socket_io   = require('socket.io');

function isThenable (object) {
    return object && Object.prototype.toString.call(object.then) === '[object Function]';
}

function start (port) {
    var d = q.defer();

    port = port || 2048;

    var app = express();
    app.use(bodyParser.json());

    var server  = http.createServer(app);
    var io      = socket_io(server);

    app.get('/', function (req, res) {
        res.send('This is BrowserControl to major Tom. Ready to kick some HTML a**.');
    });

    app.get('/test/slow/:timeout', function (req, res) {
        setTimeout(function () {
            res.send('ok');
        }, parseInt(req.params.timeout, 10));
    });

    var serverHandle = {
        serverAddress: null,
        onConnection: null,
        beforeStop: null,
        get: app.get.bind(app),
        post: app.post.bind(app),
        put: app.put.bind(app),
        delete: app.delete.bind(app),
        stop: function () {
            var d = q.defer();

            var beforeStop = serverHandle.beforeStop ? serverHandle.beforeStop() : null;

            if (isThenable(beforeStop)) {
                beforeStop.then(d.resolve);
            } else {
                d.resolve();
            }

            return d.promise;
        }
    };

    io.on('connection', function (socket) {
        if (serverHandle.onConnection) {
            serverHandle.onConnection(socket);
        }
    });

    try {
        server.listen(port, function () {
            var host = server.address().address;
            var port = server.address().port;

            if (host === '0.0.0.0') {
                host = '127.0.0.1';
            }

            serverHandle.serverAddress = 'http://' + host + ':' + port;

            d.resolve(serverHandle);
        });
    } catch (e) {
        d.reject(e);
    }

    return d.promise;
}

exports.start = start;

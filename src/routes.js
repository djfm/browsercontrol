var browser = require('./browser');
var sessions = require('./sessions');

function wrapResponse (response) {
	return function (result) {
		if (result && result.isError) {
			response.status(500).send(result);
		} else {
			response.send(result);
		}
	};
}

function promiseResponse (response, promise) {
	promise
	.then(wrapResponse(response))
	.fail(function (reason) {
		response.status(500).send({
			isError: true,
			message: reason.toString(),
			class: 'Error'
		})
	});
}

function sendError(response, klass, message) {
	response.status(500).send({
		isError: true,
		message: message,
		class: klass
	});
}

function setup(app, serverAddress) {
	app.get('/', function (req, res) {
		res.send('BrowserControl is up and running, ready to kick some HTML a**.');
	});

	app.post('/session', function (req, res) {
		browser.start({
			serverAddress: serverAddress,
			requiredCapabilities: req.body.requiredCapabilities || {},
			desiredCapabilities: req.body.desiredCapabilities || {}
		}).then(function (data) {
			res.send(data);
		}).fail(function (err) {
			res.status(500).send({
				message: err.toString()
			});
		});
	});

	app.delete('/session/:id', function (req, res) {
		promiseResponse(res, sessions.destroy(req.params.id));
	});

	app.get('/session/:id', function (req, res) {
		var session = sessions.get(req.params.id);
		if (session) {
			res.send(session.actualCapabilities);
		} else {
			sendError(res, 'NoSuchSession');
		}
	});

	app.get('/sessions', function (req, res) {
		res.send(sessions.getAllCapabilities());
	});

	app.post('/session/:id/url', function (req, res) {
		promiseResponse(res, sessions.setURL(req.params.id, req.body.url));
	});

	app.get('/session/:id/url', function (req, res) {
		promiseResponse(res, sessions.getURL(req.params.id));
	});

	app.post('/session/:id/element', function (req, res) {
		promiseResponse(res, sessions.findElement(req.params.id, req.body));
	});

	app.post('/session/:id/elements', function (req, res) {
		promiseResponse(res, sessions.findElements(req.params.id, req.body));
	});
}

exports.setup = setup;

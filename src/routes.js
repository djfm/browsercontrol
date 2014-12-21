var browser = require('./browser');
var sessions = require('./sessions');

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
		sessions.destroy(req.params.id).then(function () {
			res.send({});
		}).fail(function (err) {
			res.status(500).send({
				message: err.toString()
			});
		});
	});

	app.get('/session/:id', function (req, res) {
		var session = sessions.get(req.params.id);
		if (session) {
			res.send(session.actualCapabilities);
		} else {
			res.status(500).send({
				message: "No such session."
			});
		}
	});

	app.get('/session/:id', function (req, res) {
		var session = sessions.get(req.params.id);
		if (session) {
			res.send(session.actualCapabilities);
		} else {
			res.status(500).send({
				message: "No such session."
			});
		}
	});

	app.get('/sessions', function (req, res) {
		res.send(sessions.getAllCapabilities());
	});
}

exports.setup = setup;
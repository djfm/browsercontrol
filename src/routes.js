var browser = require('./browser');

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

}

exports.setup = setup;
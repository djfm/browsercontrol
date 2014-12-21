/* global before, after, describe, it */

var chai = require('chai');
var q = require('q');
var request = require('request');

chai.use(require('chai-as-promised'));
chai.should();

var server = require('../src/server');

function get(path) {
	var d = q.defer();

	var url = server.getAddress() + path;
	request(url, function (err, response, body) {
		if (err) {
			d.reject(err);
		} else {
			d.resolve({
				response: response,
				body: body,
				statusCode: response.statusCode
			});
		}
	});

	return d.promise;
}

function post(path, payload) {
	var d = q.defer();

	var options = {
		url: server.getAddress() + path,
		json: true,
		method: 'POST',
		body: payload || {}
	};

	request(options, function (err, response, body) {
		if (err) {
			d.reject(err);
		} else {
			d.resolve({
				response: response,
				body: body,
				statusCode: response.statusCode
			});
		}
	});

	return d.promise;
}

before(function(done) {
	server.start(0).then(done.bind(undefined, undefined));
});

describe('BrowserControl', function() {
	describe('Session', function() {
		it('should create a session', function (done) {
			post('/session')
			.get('statusCode')
			.should.become(200)
			.notify(done);
		});
	});
});

after(function(done) {
	server.stop().then(done.bind(undefined, undefined));
});
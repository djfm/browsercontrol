/* global before, after, describe, it */

var chai = require('chai');
var q = require('q');
var _ = require('underscore');
var request = require('request');

chai.use(require('chai-as-promised'));
chai.should();

var server = require('../src/server');

function promiseRequest(url, method, payload) {
	var d = q.defer();

	var options = {
		url: url,
		method: method,
		json: true
	};

	if (payload) {
		options.body = payload;
	}

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

function get(path) {
	var url = server.getAddress() + path;
	return promiseRequest(url, 'GET');
}

function post(path, payload) {
	var url = server.getAddress() + path;
	return promiseRequest(url, 'POST', payload);
}

function del(path) {
	var url = server.getAddress() + path;
	return promiseRequest(url, 'DELETE');
}

before(function(done) {
	server.start(0).then(done.bind(undefined, undefined));
});

describe('BrowserControl', function() {
	describe('Session', function() {
		it('should create a session...', function (done) {
			post('/session')
			.then(function (data) {
				data.statusCode.should.equal(200);
				data.body.sessionId.should.equal(1);
				done();
			})
			.fail(done);
		});

		it('...and another one', function (done) {
			post('/session')
			.then(function (data) {
				data.statusCode.should.equal(200);
				data.body.sessionId.should.equal(2);
				done();
			})
			.fail(done);
		});

		it('should get the first session\'s capabilities', function (done) {
			get('/session/1')
			.then(function (data) {
				data.statusCode.should.equal(200);
				data.body.should.have.property('browserName');
				done();
			})
			.fail(done);
		});

		it('should list all sessions', function (done) {
			get('/sessions')
			.then(function (data) {
				data.statusCode.should.equal(200);
				data.body.length.should.equal(2);
				data.body[0].should.have.property('id');
				data.body[0].should.have.property('capabilities');
				done();
			})
			.fail(done);
		});

		it('should destroy the second session', function (done) {
			del('/session/2').get('statusCode').should.become(200).notify(done);
		});

		it('should navigate to a page', function (done) {
			var url = 'file://' + __dirname + '/pages/index.html';

			post('/session/1/url', {url: url})
			.then(function () {
				return get('/session/1/url');
			})
			.then(function (data) {
				data.body.should.equal(url);
				done();
			})
			.fail(done);
		});

		describe('findElement', function () {
			_.each({
				'css selector': ['#hello', '#not-hello'],
				'id': ['hello', 'not-hello'],
				'class name': ['some-class', 'some-non-existing-class'],
				'name': ['stain', 'not-stain'],
				'link text': ["I'm a LINK", "I'm a"],
				'partial link text': ["I'm a", "I'm not a"],
				'tag name': ["a", "b"],
				'xpath': ["//a", "//b"],
			}, function (value, using) {
				it('Should find `' + value[0] + '` using `' + using + '`', function (done) {
					post('/session/1/element', {
						using: using,
						value: value[0]
					}).then(function (response) {
						response.statusCode.should.equal(200);
						done();
					})
					.fail(done);
				});
				it('Should not find `' + value[1] + '` using `' + using + '`', function (done) {
					post('/session/1/element', {
						using: using,
						value: value[1]
					}).then(function (response) {
						response.statusCode.should.equal(500);
						response.body.class.should.equal('NoSuchElement');
						done();
					})
					.fail(done);
				});
			});
		});

		describe('findElements', function () {
			_.each({
				'css selector': {'#hello': 1},
				'id': {'hello': 1},
				'class name': {'three': 3},
				'name': {'stain': 1}
			}, function (values, using) {
				_.each(values, function (count, selector) {
					it('Should find ' + count + ' result(s) for `' + selector + '` using `' + using + '`', function (done) {
						post('/session/1/elements', {
							using: using,
							value: selector
						}).then(function (response) {
							response.statusCode.should.equal(200);
							response.body.length.should.equal(count);
							done();
						})
						.fail(done);
					});
				});
			});
		});
	});
});

after(function(done) {
	server.stop().then(done.bind(undefined, undefined));
});

/* global before, beforeEach, after, describe, it */

var chai = require('chai');
var q = require('q');
var _ = require('underscore');
var request = require('request');

chai.use(require('chai-as-promised'));
chai.should();

var browsercontrol = require('../src/browsercontrol');

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

var bcInstance;
var indexURL = 'file://' + __dirname + '/pages/index.html';

function get(path) {
	var url = bcInstance.getServerAddress() + path;
	return promiseRequest(url, 'GET');
}

function post(path, payload) {
	var url = bcInstance.getServerAddress() + path;
	return promiseRequest(url, 'POST', payload);
}

function del(path) {
	var url = bcInstance.getServerAddress() + path;
	return promiseRequest(url, 'DELETE');
}

before(function (done) {
	browsercontrol.start(0).then(function (instance) {
		bcInstance = instance;
		done();
	}).fail(done);
});

describe('BrowserControl', function() {
	describe('Session', function() {
		it('should create a session...', function (done) {
			post('/session')
			.then(function (response) {
				response.statusCode.should.equal(200);
				response.body.should.have.property('sessionId');
				done();
			})
			.fail(done);
		});

		it('...and another one', function (done) {
			post('/session')
			.then(function (response) {
				response.statusCode.should.equal(200);
				response.body.should.have.property('sessionId');
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
			post('/session/1/url', {url: indexURL})
			.then(function () {
				return get('/session/1/url');
			})
			.then(function (data) {
				data.body.should.equal(indexURL);
				done();
			})
			.fail(done);
		});

		describe('executeScript', function () {
			before(function () {
				return post('/session/1/url', {url: indexURL});
			});

			it('should compute 40 + 2', function (done) {
				post('/session/1/execute', {
					script: 'return 40 + 2'
				})
				.get('body').should.become(42)
				.notify(done);
			});

			it('should compute 40 + 2 (using args)', function (done) {
				post('/session/1/execute', {
					script: 'return arguments[0] + arguments[1]',
					args: [40, 2]
				})
				.get('body').should.become(42)
				.notify(done);
			});

			it('should retrieve 42 from the page\'s globals', function (done) {
				post('/session/1/execute', {
					script: 'return fortyTwo'
				})
				.get('body').should.become(42)
				.notify(done);
			});
		});

		describe('executeScript (async)', function () {
			before(function () {
				return post('/session/1/url', {url: indexURL});
			});

			it('should compute 40 + 2 after a small timeout', function (done) {
				post('/session/1/execute_async', {
					script: 'var done = arguments[0]; window.setTimeout(function () {done(40 + 2);}, 42);'
				})
				.get('body').should.become(42)
				.notify(done);
			});
		});

		describe('Timeouts', function () {

			beforeEach(function () {
				return post('/session/1/url', {url: indexURL});
			});

			after(function () {
				return post('/session/1/timeouts', zeroTimeouts);
			});

			var zeroTimeouts = {
				script: 0,
				implicit: 0,
				'page load': 0
			};

			var timeouts = {
				script: 300,
				implicit: 5000,
				'page load': 1000
			};

			it('with default timeouts, should not find element that will appear later', function (done) {
				post('/session/1/element/', {using: 'id', value: 'eventually-on-page'})
				.get('statusCode').should.become(500).notify(done);
			});

			it('with default timeouts, should be able to load a slow page', function (done) {
				this.timeout(3000);
				post('/session/1/url/', {url: bcInstance.getServerAddress() + '/test/slow/2000'})
				.get('statusCode').should.become(200).notify(done);
			});

			it('should set timeouts', function (done) {
				post('/session/1/timeouts', timeouts)
				.then(function () {
					return get('/session/1/timeouts').get('body');
				})
				.should.become(timeouts)
				.notify(done);
			});

			it('with increased implicit timeout, should find element after a little while', function (done) {
				post('/session/1/element/', {using: 'id', value: 'eventually-on-page'})
				.get('statusCode').should.become(200).notify(done);
			});

			it('with a page load timeout, should not be able to load a slow page', function (done) {
				this.timeout(3000);
				post('/session/1/url/', {url: bcInstance.getServerAddress() + '/test/slow/2000'})
				.then(function (response) {
					response.statusCode.should.equal(500);
					response.body.class.should.equal('Timeout');
					done();
				})
				.fail(done);
			});

			it('with a script timeout, should throw an error on long running async script', function (done) {
				post('/session/1/execute_async', {
					script: 'var done = arguments[0]; window.setTimeout(function () {done(40 + 2);}, 500);'
				})
				.then(function (response) {
					response.statusCode.should.equal(500);
					done();
				})
				.fail(done);
			});
		});

		describe('findElement', function () {

			before(function () {
				return post('/session/1/url', {url: indexURL});
			});

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
				it('should find `' + value[0] + '` using `' + using + '`', function (done) {
					post('/session/1/element', {
						using: using,
						value: value[0]
					}).then(function (response) {
						response.statusCode.should.equal(200);
						done();
					})
					.fail(done);
				});
				it('should not find `' + value[1] + '` using `' + using + '`', function (done) {
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

			it('should throw an error if I try to get an element that does NOT exist', function (done) {
				get('/session/1/element/1000').then(function (response) {
					response.statusCode.should.equal(500);
					response.body.class.should.equal('StaleElementReference');
					done();
				})
				.fail(done);
			});

			it('should not throw an error if I try to get an element that DOES exist', function (done) {
				get('/session/1/element/1').then(function (response) {
					response.statusCode.should.equal(200);
					done();
				})
				.fail(done);
			});

			describe('Nested', function () {
				it('should find a nested element by css selector', function (done) {
					post('/session/1/element', {using: 'css selector', value: '#root'})
					.get('response').get('body').get('ELEMENT')
					.then(function (elementId) {
						return post('/session/1/element/' + elementId + '/element', {using: 'css selector', value: '.child'});
					})
					.then(function (response) {
						response.statusCode.should.equal(200);
						done();
					})
					.fail(done);
				});
				it('should find a nested element by xpath', function (done) {
					post('/session/1/element', {using: 'css selector', value: '#root'})
					.get('response').get('body').get('ELEMENT')
					.then(function (elementId) {
						return post('/session/1/element/' + elementId + '/element', {using: 'xpath', value: './span'});
					})
					.then(function (response) {
						response.statusCode.should.equal(200);
						done();
					})
					.fail(done);
				});
			});
		});

		describe('findElements', function () {

			before(function () {
				return post('/session/1/url', {url: indexURL});
			});

			_.each({
				'css selector': {'#hello': 1},
				'id': {'hello': 1},
				'class name': {'three': 3},
				'name': {'stain': 1}
			}, function (values, using) {
				_.each(values, function (count, selector) {
					it('should find ' + count + ' result(s) for `' + selector + '` using `' + using + '`', function (done) {
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

			describe('Nested', function () {
				it('should find a nested element', function (done) {
					post('/session/1/element', {using: 'css selector', value: '#root'})
					.get('response').get('body').get('ELEMENT')
					.then(function (elementId) {
						return post('/session/1/element/' + elementId + '/elements', {using: 'css selector', value: '.child'});
					})
					.then(function (response) {
						response.statusCode.should.equal(200);
						response.body.length.should.equal(1);
						done();
					})
					.fail(done);
				});
				it('should not find a nested element that is not there', function (done) {
					post('/session/1/element', {using: 'css selector', value: '#root'})
					.get('response').get('body').get('ELEMENT')
					.then(function (elementId) {
						return post('/session/1/element/' + elementId + '/elements', {using: 'css selector', value: '.not-child'});
					})
					.then(function (response) {
						response.statusCode.should.equal(200);
						response.body.length.should.equal(0);
						done();
					})
					.fail(done);
				});
				it('should throw a StaleElementReference if the root is not there', function (done) {
					post('/session/1/element/6666/elements', {using: 'id', value: 'bob'})
					.then(function (response) {
						response.statusCode.should.equal(500);
						response.body.class.should.equal('StaleElementReference');
						done();
					})
					.fail(done);
				});
			});
		});

		describe('getElementInfo', function () {

			before(function () {
				return post('/session/1/url', {url: indexURL});
			});

			var tests = [
				{
					type: 'text',
					selector: {
						using: 'id',
						value: 'text'
					},
					expectedResponseBody: 'GoT TEXT'
				},
				{
					type: 'value',
					selector: {
						using: 'css selector',
						value: '[name=stain]'
					},
					expectedResponseBody: 'My Name is Stain, I don\'t complain.'
				},
				{
					type: 'name',
					selector: {
						using: 'css selector',
						value: 'div'
					},
					expectedResponseBody: 'DIV'
				},
				{
					type: 'location',
					selector: {
						using: 'id',
						value: 'hello'
					},
					expectedResponseBody: {x: 0, y:0}
				},
				{
					type: 'size',
					selector: {
						using: 'id',
						value: 'square'
					},
					expectedResponseBody: {width: 50, height:50}
				}
			];

			_.each(tests, function (test) {
				it('should get the element\'s `' + test.type + '`', function (done) {
					post('/session/1/element', test.selector).get('body').get('ELEMENT')
					.then(function (elementId) {
						return get('/session/1/element/' + elementId + '/' + test.type);
					})
					.get('body').should.become(test.expectedResponseBody)
					.notify(done);
				});
			});
		});

		describe('Click', function () {

			before(function () {
				return post('/session/1/url', {url: indexURL});
			});

			it('should click on an element', function (done) {
				post('/session/1/element', {using: 'id', value: 'click'})
				.then(function (response) {
					return post('/session/1/element/' + response.body.ELEMENT + '/click');
				})
				.then(function () {
					return post('/session/1/element', {using: 'css selector', value: '#clicked'});
				})
				.then(function (response) {
					response.statusCode.should.equal(200);
					done();
				})
				.fail(done);
			});

			var cannotClick = {
				'#cannot-click-disabled': 'ElementIsDisabled',
				'#cannot-click-display-none': 'ElementNotVisible',
				'#cannot-click-visibility-hidden': 'ElementNotVisible',
				'#cannot-click-zero-width': 'ElementNotVisible',
				'#cannot-click-zero-height': 'ElementNotVisible'
			};

			_.each(cannotClick, function (expectedError, cssSelector) {
				it('should not be able to click on `' + cssSelector + '` (because `' + expectedError +  '`)', function (done) {
					post('/session/1/element', {using: 'css selector', value: cssSelector}).get('body').get('ELEMENT')
					.then(function (elementId) {
						return post('/session/1/element/' + elementId + '/click');
					}).then(function (response) {
						response.statusCode.should.equal(500);
						response.body.class.should.equal(expectedError);
						done();
					})
					.fail(done);
				});
			});
		});
	});
});

after(function (done) {
	if (bcInstance) {
		bcInstance.stop().then(function () {
			done();
		}).fail(done);
	} else {
		done();
	}
});

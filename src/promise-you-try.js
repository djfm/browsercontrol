var q = require('q');

function promiseYouTry (promf, timeout, interval) {

	timeout = timeout || 10000;
	interval = interval || 1000;

	var maxTime = Date.now() + timeout;

	function makeAttempt () {
		var d = q.defer();

		promf().fail(function (reason) {
			if (Date.now() < maxTime) {
				setTimeout(function () {
					makeAttempt().then(d.resolve).fail(d.reject);
				}, interval);
			} else {
				d.reject(reason);
			}
		}).then(d.resolve);

		return d.promise;
	}

	return makeAttempt();
}

module.exports = promiseYouTry;

function promiseYouTry (promf, timeout, interval) {

	timeout = timeout || 10000;
	interval = 1000;

	var maxTime = Date.now() + timeout;

	function makeAttempt () {
		promf().fail(function (reason) {
			if (Date.now() < maxTime) {
				setTimeout(makeAttempt, interval);
			} else {
				throw reason;
			}
		});
	}

	makeAttempt();
}

module.exports = promiseYouTry;
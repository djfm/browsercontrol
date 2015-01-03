/* global chrome, io, browsercontrol */

var socket = io(browsercontrol.serverAddress);

var userSessionSettings = {
	timeouts: {
		script: 0,
		implicit: 0,
		'page load': 0
	}
};

/**
 * Determine whether each tab is ready to reply to commands
 */
var tabsListening = {};
chrome.runtime.onMessage.addListener(function (request, sender, respond) {
	if ('listening' === request.status) {
		var tabListening = tabsListening[sender.tab.id] = tabsListening[sender.tab.id] || {callbacksQueue: []};
		tabListening.status = 'listening';

		// Call enqueued callbacks if any
		for (var i = 0, len = tabListening.callbacksQueue.length; i < len; ++i) {
			tabListening.callbacksQueue[i]();
		}

		// clear them
		tabListening.callbacksQueue = [];

		respond({});
	} else if ('debugMessage' === request.type) {
		socket.emit('debugMessage', request.data);
	}
});

function debug (data) {
	socket.emit('debugMessage', data);
}

/**
 * Listen for tabs updates.
 */
var tabsCallbacks = [];
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	for (var i = 0, len = tabsCallbacks.length; i < len;) {
		if (tabsCallbacks[i](tabId, changeInfo, tab) === true) {
			tabsCallbacks.splice(i, 1);
			--len;
		} else {
			++i;
		}
	}
});

function onTabUpdate (callback) {
	tabsCallbacks.push(callback);
}

/**
 * Send a message to a tab, queueing the request if
 * the tab has not yet sent us a message telling that it
 * is listening.
 */
function askTab (tabId, query, callback) {

	function request () {
		chrome.tabs.sendMessage(tabId, query, callback);
	}

	if (!tabsListening[tabId]) {
		tabsListening[tabId] = {
			status: 'not listening',
			callbacksQueue: [request]
		};
	} else if ('listening' === tabsListening[tabId].status) {
		request();
	} else {
		tabsListening[tabId].callbacksQueue.push(request);
	}
}

/**
 * Shortcut to pass a query to the active tab.
 */
function askActiveTab (query, callback) {
	withActiveTab(function (tab) {
		askTab(tab.id, query, callback);
	});
}

var events = {};
function onBrowserControlCommand (command, callback) {
	if (!events.hasOwnProperty(command)) {
		events[command] = true;
		socket.on(command, function (data) {
			callback(data.payload, function (response) {
				socket.emit(command, {
					id: data.id,
					payload: response
				});
			});
		});
	}
}

function withActiveTab (callback) {
	chrome.tabs.query({active: true, windowId: chrome.windows.WINDOW_ID_CURRENT}, function (tabs) {
		callback(tabs[0], tabs[0].id);
	});
}

onBrowserControlCommand('setURL', function (url, respond) {

	var timeout = userSessionSettings.timeouts['page load'];
	var responseWasSent = false;
	var timeoutHandle;

	if (timeout > 0) {
		timeoutHandle = window.setTimeout(function () {
			responseWasSent = true;
			respond({
				isError: true,
				class: 'Timeout',
				message: 'Could not load `' + url + '` in the imparted time (' + timeout + 'ms).'
			});
		}, timeout);
	}

	withActiveTab(function (tab) {
		onTabUpdate(function (tabId, changeInfo) {
			if (tabId === tab.id && changeInfo.status === 'complete') {
				if (!responseWasSent) {
					window.clearTimeout(timeoutHandle);
					respond(url);
				}
				return true;
			}
		});
		chrome.tabs.update(tab.id, {url: url});
	});
});

onBrowserControlCommand('getURL', function (nothing, respond) {
	withActiveTab(function (tab) {
		respond(tab.url);
	});
});

onBrowserControlCommand('getTitle', function (nothing, respond) {
	withActiveTab(function (tab) {
		respond(tab.title);
	});
});

onBrowserControlCommand('setTimeouts', function (timeouts, respond) {
	userSessionSettings.timeouts = timeouts;
	respond({});
});

onBrowserControlCommand('getTimeouts', function (nothing, respond) {
	respond(userSessionSettings.timeouts);
});

var passAlongToActiveTab = [
	'findElement',
	'findElements',
	'describeElement',
	'clickElement',
	'executeScript',
	'getElementInfo'
];

for (var i = 0, len = passAlongToActiveTab.length; i < len; ++i) {
	(function (command) {
		onBrowserControlCommand(command, function (query, respond) {
			askActiveTab({
				command: command,
				query: query,
				userSessionSettings: userSessionSettings
			}, respond);
		});
	})(passAlongToActiveTab[i]);
}

// Signal server on the other end that this browser is ready for work.
socket.emit('emitEvent', browsercontrol.startUpResolverEventName);

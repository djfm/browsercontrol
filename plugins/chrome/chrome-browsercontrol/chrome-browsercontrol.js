/* global chrome, io, browsercontrol */

var socket = io(browsercontrol.serverAddress);

var events = {};

var tabsListening = {};

/**
 * Determine whether each tab is ready to reply to commands
 */
chrome.runtime.onMessage.addListener(function (request, sender, respond) {
	if ('listening' === request.status) {
		var tabListening = tabsListening[sender.tab.id] = tabsListening[sender.tab.id] || {callbacksQueue: []};
		tabListening.status = 'listening';

		// Called enqueued callbacks if any
		for (var i = 0, len = tabListening.callbacksQueue.length; i < len; ++i) {
			tabListening.callbacksQueue[i]();
		}

		// clear them
		tabListening.callbacksQueue = [];

		respond({});
	}
});

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

function on (command, callback) {
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

on('setURL', function (url, respond) {
	withActiveTab(function (tab) {
		onTabUpdate(function (tabId, changeInfo) {
			if (tabId === tab.id && changeInfo.status === 'complete') {
				respond(url);
				return true;
			}
		});
		chrome.tabs.update(tab.id, {url: url});
	});
});

on('getURL', function (nothing, respond) {
	withActiveTab(function (tab) {
		respond(tab.url);
	});
});

var passAlongToActiveTab = ['findElement', 'findElements', 'describeElement'];

for (var i = 0, len = passAlongToActiveTab.length; i < len; ++i) {
	(function (command) {
		on(command, function (query, respond) {
			askActiveTab({
				command: command,
				query: query
			}, respond);
		});
	})(passAlongToActiveTab[i]);
}

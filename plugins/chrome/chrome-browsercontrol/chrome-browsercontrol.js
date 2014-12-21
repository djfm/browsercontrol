/* global chrome, io, browsercontrol */

var socket = io(browsercontrol.serverAddress);

var events = {};

function on(command, callback) {
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

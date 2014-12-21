/* global chrome, io, browsercontrol */

var socket = io(browsercontrol.serverAddress);

socket.on('alert', function (what) {
	alert(what);
});
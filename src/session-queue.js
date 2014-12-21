var queue = [];

function add(onCreated, onDestroyed) {
	queue.push({
		onCreated: onCreated,
		onDestroyed: onDestroyed
	});
}

function shift() {
	return queue.shift();
}

exports.add = add;
exports.shift = shift;
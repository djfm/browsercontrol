var _ = require('underscore');

var maxids = {};

function get (prefix) {

    prefix = prefix || 'lambda';

    if (!_.has(maxids, prefix)) {
        maxids[prefix] = 0;
    }

    return prefix + '_' + (maxids[prefix]++);
}

exports.get = get;

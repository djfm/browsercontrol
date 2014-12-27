/* global chrome, $ */

/* global StaleElementReference, ElementIsDisabled, ElementNotVisible */

function error(klass, message) {
    return {
        isError: true,
        class: klass,
        message: message
    };
}

function debug (data) {
    chrome.runtime.sendMessage({
        type: 'debugMessage',
        data: data
    });
}

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (!request.command) {
        respond(error('UnknownRequest'));
        return;
    }

    if (!commands[request.command]) {
        respond(error('UnknownCommand', request.command));
        return;
    }

    var handler = commands[request.command];

    /**
     * This is for debug, if we want to do something with the response
     * before sending it to the background page.
     */
    function spy (response) {
        // debug(response);
        respond(response);
    }

    try {
        if (handler.length === 3) {
            return handler(request.query, request.userSessionSettings, spy);
        } else {
            return handler(request.query, spy);
        }
    } catch (err) {
        respond(error(err.constructor.name, err.toString()));
    }
});

var elements = {
    maxId: 0,
    cache: {}
};

function assignElementId (element) {
    var id = elements.maxId++;
    elements.cache[id] = element;

    return id;
}

function getElement (elementId) {

    if (!elements.cache[elementId] || !elements.cache[elementId].ownerDocument.contains(elements.cache[elementId])) {
        throw new StaleElementReference();
    }

    return elements.cache[elementId];
}

function findElement (query, sessionSettings, respond) {
    query.first = true;
    findElements(query, sessionSettings, function (results) {
        if (results.length === 0) {
            respond(error('NoSuchElement'));
        } else {
            respond(results[0]);
        }
    });

    // Mark this callback as asynchronous if needed.
    return (sessionSettings.timeouts.implicit > 0);
}

function findElements (query, sessionSettings, respond) {
    var selector = null;
    var xpath = false;

    if (query.using === 'css selector') {
        selector = query.value;
    } else if (query.using === 'id') {
        selector = '#' + query.value;
    }  else if (query.using === 'class name') {
        selector = '.' + query.value;
    } else if (query.using === 'name') {
        selector = '[name="' + query.value + '"]';
    } else if (query.using === 'link text' || query.using === 'partial link text') {
        selector = 'a:contains("' + query.value + '")';
    } else if (query.using === 'tag name') {
        selector = query.value;
    } else if (query.using === 'xpath') {
        xpath = true;
        selector =  query.value;
    }

    function doSearch () {
        var elements = [];

        if (selector && !xpath) {
            var list;

            if (query.root) {
                list = $(getElement(query.root)).find(selector);
            } else {
                list = $(selector);
            }

            list.each(function (i, element) {
                if (query.using === 'link text') {
                    if ($(element).text() !== query.value) {
                        return;
                    }
                }
                elements.push({ELEMENT: assignElementId(element)});
            });
        } else if (selector && xpath) {
            var root = query.root ? getElement(query.root) : document;
            var iterator = document.evaluate(selector, root);
            var element;
            while ((element = iterator.iterateNext())) {
                elements.push({ELEMENT: assignElementId(element)});
                if (query.first) {
                    break;
                }
            }
        }

        return elements;
    }

    var elements = doSearch();

    if (elements.length > 0) {
        respond(elements);
    } else if (sessionSettings.timeouts.implicit) {
        var maxTime     = Date.now() + sessionSettings.timeouts.implicit;
        var interval    = window.setInterval(function () {
            if (Date.now() > maxTime) {
                window.clearInterval(interval);
                respond([]);
            } else {
                var elements = doSearch();
                if (elements.length > 0) {
                    window.clearInterval(interval);
                    respond(elements);
                }
            }
        }, 200);
    } else {
        respond([]);
    }

    // Mark this callback as asynchronous if needed.
    return (sessionSettings.timeouts.implicit > 0);
}

function describeElement (id, respond) {
    getElement(id);
    respond({ELEMENT: id});
}

function ensureElementCanBeInteractedWith ($element) {
    if (
        !$element.is(':visible') ||
        $element.css('visibility') === 'hidden' ||
        $element.width() === 0 ||
        $element.height() === 0
    ) {
        throw new ElementNotVisible();
    }

    if ($element.prop('disabled')) {
        throw new ElementIsDisabled();
    }
}

function clickElement (id, respond) {
    var element = $(getElement(id));

    ensureElementCanBeInteractedWith(element);

    element.click();
    respond({});
}

var commands = {
    findElement: findElement,
    findElements: findElements,
    describeElement: describeElement,
    clickElement: clickElement
};

// Inform the background page that we're ready to take orders.
chrome.runtime.sendMessage({status: 'listening'});

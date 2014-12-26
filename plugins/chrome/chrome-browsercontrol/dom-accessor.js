/* global chrome, $ */

/* global StaleElementReference, ElementIsDisabled, ElementNotVisible */

function error(klass, message) {
    return {
        isError: true,
        class: klass,
        message: message
    };
}

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (request.command) {
        if (commands[request.command]) {
            try {
                commands[request.command](request.query, respond);
            } catch (err) {
                respond(error(err.constructor.name, err.toString()));
            }
        } else {
            respond(error('UnknownCommand', request.command));
        }
    } else {
        respond(error('UnknownRequest'));
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

function findElement (query, respond) {
    query.first = true;
    findElements(query, function (results) {
        if (results.length === 0) {
            respond(error('NoSuchElement'));
        } else {
            respond(results[0]);
        }
    });
}

function findElements (query, respond) {
    var elements = [];
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

    respond(elements);
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

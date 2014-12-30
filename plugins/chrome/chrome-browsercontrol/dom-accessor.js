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

function elementDisplayed ($element) {
    return  $element.is(':visible') &&
            $element.css('visibility') !== 'hidden' &&
            $element.width() !== 0 &&
            $element.height() !== 0;
}

function ensureElementCanBeInteractedWith ($element) {
    if (!elementDisplayed($element)) {
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

var injectedScriptsCount = 0;
/**
 * TODO:    JSON objects that define a WebElement reference will be converted to the corresponding DOM element.
 * 			Likewise, any WebElements in the script result will be returned to the client as WebElement JSON objects.
 *
 * 			Cancel async script if unload event is fired.
 */
function executeScript (options, sessionSettings, respond) {
    var script = document.createElement('script');
    var scriptId = chrome.runtime.id + '_injectedScript_' + (injectedScriptsCount++);
    var scriptTimeoutHandle;

    function scriptResponseListener (event) {
        if (event.data.type === scriptId) {
            cleanUp();
            respond(event.data.scriptResult);
        }
    }

    function cleanUp () {
        window.removeEventListener('message', scriptResponseListener);
        script.parentNode.removeChild(script);
        if (scriptTimeoutHandle) {
            window.clearTimeout(scriptTimeoutHandle);
        }
    }

    function cancelScriptBecauseOfTimeout () {
        cleanUp();
        respond(error('Timeout'));
    }

    window.addEventListener('message', scriptResponseListener);

    var args = options.args || [];

    var serializedArgs = [];
    for (var i = 0, len = args.length; i < len; ++i) {
        serializedArgs.push(JSON.stringify(args[i]));
    }

    if (options.async) {
        // push the name of the callback as last argument
        serializedArgs.push('__browserControlScriptFinished__');

        if (sessionSettings.timeouts.script > 0) {
            scriptTimeoutHandle = window.setTimeout(cancelScriptBecauseOfTimeout, sessionSettings.timeouts.script);
        }
    }

    var argsArray = '[' + serializedArgs.join(', ') + ']';

    var userScript = '(function () { ' + options.script + ' }).apply(undefined, ' + argsArray + ')';

    var scriptBody = function (scriptId, userScript, async) {
        /* jshint evil:true */

        function __browserControlScriptFinished__ (scriptResult) {
            window.postMessage({type: scriptId, scriptResult: scriptResult}, '*');
        }

        if (async) {
            eval(userScript);
        } else {
            __browserControlScriptFinished__(eval(userScript));
        }
    };

    var scriptArgs = [scriptId, userScript, options.async];


    script.textContent = '(' + scriptBody.toString() + ').apply(undefined, ' + JSON.stringify(scriptArgs) + ');';
    document.documentElement.appendChild(script);

    // this is async
    return true;
}

function getElementInfo (query, respond) {
    var element = $(getElement(query.elementId));
    switch (query.type) {
        case 'text':
            respond(element.text());
            break;
        case 'value':
            respond(element.val());
            break;
        case 'name':
            respond(element.prop('tagName'));
            break;
        case 'selected':
            respond(element.is(':selected') || element.is(':checked'));
            break;
        case 'enabled':
            respond(element.is(':enabled'));
            break;
        case 'displayed':
            respond(elementDisplayed(element));
            break;
        case 'location':
            var offset = element.offset();
            respond({
                x: offset.left,
                y: offset.top
            });
            break;
        case 'size':
            respond({
                width: element.width(),
                height: element.height()
            });
            break;
        default:
            respond(error('UnknownCommand'));
    }
}

var commands = {
    findElement: findElement,
    findElements: findElements,
    describeElement: describeElement,
    clickElement: clickElement,
    executeScript: executeScript,
    getElementInfo: getElementInfo
};

// Inform the background page that we're ready to take orders.
chrome.runtime.sendMessage({status: 'listening'});

var _       = require('underscore');
var browser = require('./browser');


function respondWithPromise (res, promise) {
    promise.then(function (result) {
        if (result && result.isError) {
            res.status(500).json(result);
        } else {
            res.json(result);
        }
    }).fail(function (reason) {
        res.status(500).json({
            isError: true,
            message: reason.toString(),
            class: reason.constructor.name
        });
    });
}

/**

 TODO: https://code.google.com/p/selenium/wiki/JsonWireProtocol


 /status                                                            TODO
 /session                                                           DONE
 /sessions                                                          DONE
 /session/:sessionId                                                DONE
 /session/:sessionId/timeouts                                       DONE
 /session/:sessionId/timeouts/async_script                          TODO
 /session/:sessionId/timeouts/implicit_wait                         TODO
 /session/:sessionId/window_handle                                  DONE?   Not so sure it is what the spec intended...
 /session/:sessionId/window_handles                                 DONE?   Not so sure it is what the spec intended...
 /session/:sessionId/url                                            DONE
 /session/:sessionId/forward                                        TODO
 /session/:sessionId/back                                           TODO
 /session/:sessionId/refresh                                        TODO
 /session/:sessionId/execute                                        DONE~   partial, need to handle sending / returning of DOM nodes
 /session/:sessionId/execute_async                                  DONE~   partial, need to handle sending / returning of DOM nodes
 /session/:sessionId/screenshot                                     TODO

 /session/:sessionId/ime/available_engines                          TODO?
 /session/:sessionId/ime/active_engine                              TODO?
 /session/:sessionId/ime/activated                                  TODO?
 /session/:sessionId/ime/deactivate                                 TODO?
 /session/:sessionId/ime/activate                                   TODO?

 /session/:sessionId/frame                                          TODO
 /session/:sessionId/frame/parent                                   TODO
 /session/:sessionId/window                                         TODO
 /session/:sessionId/window/:windowHandle/size                      TODO
 /session/:sessionId/window/:windowHandle/position                  TODO
 /session/:sessionId/window/:windowHandle/maximize                  TODO
 /session/:sessionId/cookie                                         TODO
 /session/:sessionId/cookie/:name                                   TODO
 /session/:sessionId/source                                         DONE
 /session/:sessionId/title                                          DONE
 /session/:sessionId/element                                        DONE
 /session/:sessionId/elements                                       DONE
 /session/:sessionId/element/active                                 DONE
 /session/:sessionId/element/:id                                    DONE
 /session/:sessionId/element/:id/element                            DONE
 /session/:sessionId/element/:id/elements                           DONE
 /session/:sessionId/element/:id/click                              DONE
 /session/:sessionId/element/:id/submit                             TODO
 /session/:sessionId/element/:id/text                               DONE~   partial, gets all the text, visible or not
 /session/:sessionId/element/:id/value                              DONE
 /session/:sessionId/keys                                           TODO
 /session/:sessionId/element/:id/name                               DONE
 /session/:sessionId/element/:id/clear                              TODO
 /session/:sessionId/element/:id/selected                           DONE
 /session/:sessionId/element/:id/enabled                            DONE
 /session/:sessionId/element/:id/attribute/:name                    TODO
 /session/:sessionId/element/:id/equals/:other                      TODO
 /session/:sessionId/element/:id/displayed                          DONE
 /session/:sessionId/element/:id/location                           DONE
 /session/:sessionId/element/:id/location_in_view                   TODO
 /session/:sessionId/element/:id/size                               DONE
 /session/:sessionId/element/:id/css/:propertyName                  TODO
 /session/:sessionId/orientation                                    TODO
 /session/:sessionId/alert_text                                     TODO
 /session/:sessionId/accept_alert                                   TODO
 /session/:sessionId/dismiss_alert                                  TODO
 /session/:sessionId/moveto                                         TODO
 /session/:sessionId/click                                          TODO
 /session/:sessionId/buttondown                                     TODO
 /session/:sessionId/buttonup                                       TODO
 /session/:sessionId/doubleclick                                    TODO
 /session/:sessionId/touch/click                                    TODO
 /session/:sessionId/touch/down                                     TODO
 /session/:sessionId/touch/up                                       TODO
 session/:sessionId/touch/move                                      TODO
 session/:sessionId/touch/scroll                                    TODO
 session/:sessionId/touch/scroll                                    TODO
 session/:sessionId/touch/doubleclick                               TODO
 session/:sessionId/touch/longclick                                 TODO
 session/:sessionId/touch/flick                                     TODO
 session/:sessionId/touch/flick                                     TODO
 /session/:sessionId/location                                       TODO
 /session/:sessionId/local_storage                                  TODO
 /session/:sessionId/local_storage/key/:key                         TODO
 /session/:sessionId/local_storage/size                             TODO
 /session/:sessionId/session_storage                                TODO
 /session/:sessionId/session_storage/key/:key                       TODO
 /session/:sessionId/session_storage/size                           TODO
 /session/:sessionId/log                                            TODO
 /session/:sessionId/log/types                                      TODO
 /session/:sessionId/application_cache/status                       TODO

 */

function setup (app, eventEmitter, sessions) {

    app.post('/session', function (req, res) {
        respondWithPromise(res, browser.start(
                req.body,
                eventEmitter,
                app.getServerAddress(),
                sessions
            )
        );
    });

    app.get('/session/:sessionId', function (req, res) {
        respondWithPromise(res, sessions.getCapabilities(req.params.sessionId));
    });

    app.get('/sessions', function (req, res) {
        respondWithPromise(res, sessions.list());
    });

    app.delete('/session/:sessionId', function (req, res) {
        respondWithPromise(res, sessions.destroy(req.params.sessionId));
    });

    app.post('/session/:sessionId/url', function (req, res) {
        respondWithPromise(res, sessions.setURL(req.params.sessionId, req.body.url));
    });

    app.get('/session/:sessionId/url', function (req, res) {
        respondWithPromise(res, sessions.getURL(req.params.sessionId));
    });

    app.get('/session/:sessionId/title', function (req, res) {
        respondWithPromise(res, sessions.getTitle(req.params.sessionId));
    });

    app.get('/session/:sessionId/source', function (req, res) {
        respondWithPromise(res, sessions.getSource(req.params.sessionId));
    });

    app.get('/session/:sessionId/window_handle', function (req, res) {
        respondWithPromise(res, sessions.getWindowHandle(req.params.sessionId));
    });

    app.get('/session/:sessionId/window_handles', function (req, res) {
        respondWithPromise(res, sessions.getWindowHandles(req.params.sessionId));
    });

    app.post('/session/:sessionId/element', function (req, res) {
        respondWithPromise(res, sessions.findElement(req.params.sessionId, req.body));
    });

    app.post('/session/:sessionId/element/active', function (req, res) {
        respondWithPromise(res, sessions.findActiveElement(req.params.sessionId, req.body));
    });

    app.post('/session/:sessionId/timeouts', function (req, res) {
        respondWithPromise(res, sessions.setTimeouts(req.params.sessionId, req.body));
    });

    app.get('/session/:sessionId/timeouts', function (req, res) {
        respondWithPromise(res, sessions.getTimeouts(req.params.sessionId));
    });

    app.post('/session/:sessionId/elements', function (req, res) {
        respondWithPromise(res, sessions.findElements(req.params.sessionId, req.body));
    });

    app.get('/session/:sessionId/element/:elementId', function (req, res) {
        respondWithPromise(res, sessions.describeElement(req.params.sessionId, req.params.elementId));
    });

    _.each(['text', 'value', 'name', 'selected', 'enabled', 'displayed', 'location', 'size'], function (type) {
        app.get('/session/:sessionId/element/:elementId/' + type, function (req, res) {
            respondWithPromise(res, sessions.getElementInfo(req.params.sessionId, {
                elementId: req.params.elementId,
                type: type
            }));
        });
    });


    app.post('/session/:sessionId/element/:elementId/element', function (req, res) {
        req.body.root = req.params.elementId;
        respondWithPromise(res, sessions.findElement(req.params.sessionId, req.body));
    });

    app.post('/session/:sessionId/element/:elementId/elements', function (req, res) {
        req.body.root = req.params.elementId;
        respondWithPromise(res, sessions.findElements(req.params.sessionId, req.body));
    });

    app.post('/session/:sessionId/element/:elementId/click', function (req, res) {
        respondWithPromise(res, sessions.clickElement(req.params.sessionId, req.params.elementId));
    });

    app.post('/session/:sessionId/execute', function (req, res) {
        respondWithPromise(res, sessions.executeScript(req.params.sessionId, req.body));
    });

    app.post('/session/:sessionId/execute_async', function (req, res) {
        req.body.async = true;
        respondWithPromise(res, sessions.executeScript(req.params.sessionId, req.body));
    });

}

exports.setup = setup;

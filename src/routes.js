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

    app.post('/session/:sessionId/element', function (req, res) {
        respondWithPromise(res, sessions.findElement(req.params.sessionId, req.body));
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

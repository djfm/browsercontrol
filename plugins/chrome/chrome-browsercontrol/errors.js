function StaleElementReference () {
    Error.call(this);
}
StaleElementReference.prototype = Object.create(Error.prototype);
StaleElementReference.prototype.constructor = StaleElementReference;

function ElementNotVisible () {
    Error.call(this);
}
ElementNotVisible.prototype = Object.create(Error.prototype);
ElementNotVisible.prototype.constructor = ElementNotVisible;

function ElementIsDisabled () {
    Error.call(this);
}
ElementIsDisabled.prototype = Object.create(Error.prototype);
ElementIsDisabled.prototype.constructor = ElementIsDisabled;

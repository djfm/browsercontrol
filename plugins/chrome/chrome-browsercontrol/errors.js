function StaleElementReference () {
    Error.call(this);
}
StaleElementReference.prototype = Object.create(Error.prototype);
StaleElementReference.prototype.constructor = StaleElementReference;

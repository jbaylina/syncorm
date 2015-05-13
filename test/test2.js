/*jslint node: true */
/*global describe, it, before, beforeEach, after, afterEach */
"use strict";

function MyClass() {

    var self = this;
    console.log("In Constructor: " +self.aClassProperty);
    return self;
}

MyClass.prototype.aClassProperty = "Hello";

var a = new MyClass();


console.log("After constructor: " + a.aClassProperty);

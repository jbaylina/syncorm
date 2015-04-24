/*jslint node: true */
"use strict";

var U = require('underscore');

// Multikey access

exports.get = function(array, keys) {
    if (!keys instanceof Array) {
        keys = [ keys];
    }
    var i;
    var a = array;
    for (i=0; i<keys.length; i++) {
        a = a[keys[i]];
        if (!a) return null;
    }
    return a;
};

exports.set = function(array, keys, obj) {
    if (!keys instanceof Array) {
        keys = [ keys];
    }
    var i;
    var a = array;
    for (i=0; i<keys.length-1; i++) {
        if (!a[keys[i]]) a[keys[i]] = {};
        a = a[keys[i]];
    }
    a[keys[keys.length-1]] = obj;
};

exports.delete = function(array, keys) {
    if (keys.length === 0) return;
    if (!keys instanceof Array) {
        keys = [ keys];
    }
    var i;
    var a = array;
    for (i=0; i<keys.length-1; i++) {
        a = a[keys[i]];
        if (!a) return null;
    }
    delete a[keys[keys.length-1]];
    if (U.isEmpty(a) === 0) {
        keys.pop();
        exports.delete(array, keys);
    }
};

exports.keys = function(array, l) {
    var keys = [];
    U.each(array, function(subArray, k) {
        if (l>1) {
            var subKeys = exports.keys(subArray , l-1);
            U.each(subKeys, function(subKey) {
                keys.push(U.union([k], subKey));
            });
        } else {
            keys.push([k]);
        }
    });
    return keys;
};

exports.each = function(array, l, fn) {
    var keys = exports.keys(array, l);
    U.each(keys, function(k) {
        fn(exports.get(array, k), k);
    });
};

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
    if (typeof l === "undefined") {
        l = exports.keyLen(array);
    }
    var keys = [];
    U.each(array, function(subArray, k) {
        if (l>1) {
            var subKeys = exports.keys(subArray , l-1);
            U.each(subKeys, function(subKey) {
                subKey.unshift(k);
                keys.push(subKey);
            });
        } else {
            keys.push([k]);
        }
    });
    return keys;
};

exports.each = function(array, l, fn) {
    if (!array) return;
    if (typeof l === "function") {
        fn = l;
        l = exports.keyLen(array);
    }
    var keys = exports.keys(array, l);
    return U.each(keys, function(k) {
        return fn(exports.get(array, k), k);
    });
};

exports.find = function(array, l, fn) {
    if (!array) return null;
    if (typeof l === "function") {
        fn = l;
        l = exports.keyLen(array);
    }
    var keys = exports.keys(array, l);
    return U.find(keys, function(k) {
        return fn(exports.get(array, k), k);
    });
};

exports.map = function(array, l, fn) {
    if (!array) return [];
    if (typeof l === "function") {
        fn = l;
        l = exports.keyLen(array);
    }
    var keys = exports.keys(array, l);
    return U.map(keys, function(k) {
        return fn(exports.get(array, k), k);
    });
};


exports.size = function(array, l) {
    if (!array) return 0;
    var keys = exports.keys(array, l);
    return keys.length;
};

exports.keyLen = function(array) {
    if (!array) return 0;
    if (typeof array !== "object") return 0;
    if (array.$all) return 0;
    var first = null;
    for (first in array) break;
    if (first) {
        return exports.keyLen(array[first]) +1;
    } else {
        return 0;
    }
};

/*jslint node: true */
"use strict";

var U = require('lodash');

// Multikey access

function normKey(k) {
    return k;
}

exports.get = function(array, keys) {
    if (! (keys instanceof Array)) {
        keys = [ keys];
    }
    var i;
    var a = array;
    for (i=0; i<keys.length; i++) {
        var k = normKey(keys[i]);
        a = a[k];
        if (!a) return null;
    }
    return a;
};

exports.set = function(array, keys, obj) {
    var k;
    if (! (keys instanceof Array)) {
        keys = [ keys];
    }
    var i;
    var a = array;
    for (i=0; i<keys.length-1; i++) {
        k = normKey(keys[i]);
        if (!a[k]) a[k] = {};
        a = a[k];
    }
    k = normKey(keys[keys.length-1]);
    a[k] = obj;
};

exports.delete = function(array, keys) {
    var k;
    if (keys.length === 0) return;
    if (! (keys instanceof Array)) {
        keys = [ keys];
    }
    var i;
    var a = array;
    for (i=0; i<keys.length-1; i++) {
        k = normKey(keys[i]);
        a = a[k];
        if (!a) return null;
    }
    k = normKey(keys[keys.length-1]);
    delete a[k];
    if (U.isEmpty(a)) {
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
    var k = U.find(keys, function(k) {
        return fn(exports.get(array, k), k);
    });
    return exports.get(array,k);
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


exports.values = function(array) {
    return exports.map(array, function(it) {
        return it;
    });
};

exports.filter = function(array, l, fn) {
    if (!array) return [];
    if (typeof l === "function") {
        fn = l;
        l = exports.keyLen(array);
    }
    var result = [];
    var keys = exports.keys(array, l);
    U.each(keys, function(k) {
        var obj = exports.get(array, k);
        if (fn(obj, k)) {
            result.push(obj);
        }
    });
    return result;
};

exports.findWhere = function(array, l, properties) {
    if (!array) return [];
    if (typeof l === "object") {
        properties = l;
        l = exports.keyLen(array);
    }
    var matcher = U.matches(properties);
    var keys = exports.keys(array, l);
    var keyFound = U.find(keys, function(k) {
        return matcher(exports.get(array, k));
    });
    return keyFound ? exports.get(array, keyFound) : null;
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
    if (first || first === "" || first === 0) {
        return exports.keyLen(array[first]) +1;
    } else {
        return 0;
    }
};

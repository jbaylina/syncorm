/*jslint node: true */
"use strict";

exports.js2db = function(v) {
	return exports.db2js(v);
};

exports.db2js = function(v, params) {
	if ((typeof v === "undefined") || (v === null)) return null;
	if (typeof v !== "string") return null;
	var idx = -1;
    if (params.options) {
        idx = params.options.indexOf(v);
    }
	if (idx <0) return null;
	return v;
};


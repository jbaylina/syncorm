/*jslint node: true */
"use strict";

exports.db2js = function(v, params) {
	if ((typeof v === "undefined") || (v === null)) return null;
	if (typeof v === "string") return v;
	return v.toString();
};

exports.js2db = function(v, params) {
	if ((typeof v === "undefined") || (v === null)) return null;
	var val = "" + v;
	var size = params.size || 255;
	val = val.substring(0, size);
	return val;
};

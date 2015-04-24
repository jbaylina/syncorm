/*jslint node: true */
"use strict";

exports.db2js = function(val) {
	var V;
	if ((typeof val === "undefined") || (val === null)) {
		V = null;
	} else {
		V = parseFloat(val);
		if (isNaN(V)) {
			V = null;
		}
	}
	return V;
};

exports.js2db = function(val) {
	return val;
};

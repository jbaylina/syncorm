/*jslint node: true */
"use strict";

exports.db2js = function(val) {
	var V;
	if ((typeof val === "undefined") || (val === null)) {
		V = null;
	} else {
		V = val ? true : false;
	}
	return V;
};

exports.js2db = function(val) {
	var V;
	if ((typeof val === "undefined") || (val === null)) {
		V = null;
	} else {
		V = val ? 1 : 0;
	}
	return V;
};

/*jslint node: true */
"use strict";

exports.js2db = function(val) {
	var V1 = exports.db2js(val);
	var V2;
	if (V1) {
		V2 = JSON.stringify(V1);
	} else {
		V2 = null;
	}
	return V2;
};

exports.db2js = function(v) {
	var obj;
	if ((typeof v === "undefined") || v=== null)  {
		return null;
	} else if (typeof v === "string") {
		try {
			obj = JSON.parse(v);
		} catch (err) {
			obj = null;
		}
		return obj;
	} else {
		return v;
	}
};

/*jslint node: true */
"use strict";

var timezone = require('timezone/loaded');

exports.db2js = function(d, params) {
	var tz = params.tz || "UTC";
	var dt;
	if (d instanceof Date) {
		dt = new Date(d);
		if (isNaN(dt.getTime())) {
			return null;
		}
		dt.setUTCMilliseconds(0);
		return dt;
	} else if (typeof d === "string") {
		dt = new Date(timezone(d, tz));
		if (isNaN(dt.getTime())) {
			dt = new Date(d);
			if (isNaN(dt.getTime())) {
				return null;
			}
		}
		dt.setUTCMilliseconds(0);
		return dt;
	} else {
		return null;
	}
};


exports.js2db = function (d, params) {
	var tz = params.tz || "UTC";
	tz = tz || "UTC";
	var dt;
	dt = exports.db2js(d, params);
	if (!dt) {
		return null;
	}
	return timezone(dt.getTime(),"%F %T", tz);
};

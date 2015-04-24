/*jslint node: true */
"use strict";

exports.db2js = function(d) {
	var dt;
	if (d instanceof Date) {
		dt = new Date(d);
		if (isNaN(dt.getTime())) {
			return null;
		}
		dt.setMilliseconds(0);
		dt.setUTCHours(0);
		dt.setUTCMinutes(0);
		dt.setUTCSeconds(0);
		return dt;
	} else if (typeof d === "string") {
		dt = new Date(d.slice(0,10) + "UTC");
		if (isNaN(dt.getTime())) {
			return null;
		}
		dt.setMilliseconds(0);
		dt.setUTCHours(0);
		dt.setUTCMinutes(0);
		dt.setUTCSeconds(0);
		return dt;
	} else {
		return null;
	}
};

exports.js2db = function(v) {
	function fill(n, size) {
		n = n.toString();
		while (n.length < size) {
			n = "0" + n;
		}
		return n;
	}

	var dt, d, m, y;
	dt = exports.db2js(v);
	if (!dt) {
		return null;
	}
	d = dt.getUTCDate();
	m = dt.getUTCMonth() + 1;
	y = dt.getUTCFullYear();

	return fill(y, 4) + "-" + fill(m, 2) + "-" + fill(d, 2);
};

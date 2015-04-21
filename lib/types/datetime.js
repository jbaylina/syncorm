/*jslint node: true */
"use strict";

var timezone = require('timezone/loaded');

function normalizedDateTime(d, tz) {
	tz = tz || "UTC";
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
}


function normalizedStrDateTime(d, tz) {
	tz = tz || "UTC";
	var dt;
	dt = normalizedDateTime(d, tz);
	if (!dt) {
		return null;
	}
	return timezone(dt.getTime(),"%F %T", tz);
}

exports.normalize = normalizedStrDateTime;

exports.createProperty = function(db,cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	var dbFieldName = sch.fields[f].dbFieldName;
	var tz = sch.fields[f].tz;

	Object.defineProperty(cls.prototype, f, {
		get: function () {
			return normalizedDateTime(this.$data[dbFieldName], tz);
		},
		set: function (val) {
			var dold, dnew;
			if (val === undefined) val=null;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			dold = normalizedStrDateTime(this.$data[dbFieldName], tz);
			dnew = normalizedStrDateTime(val, tz);

			if (dold !== dnew) {
				db.$transaction.addUpdate(this, f, dold, dnew);
				db.$removeFromIndexes(this);
				db.$destroyRelations(this);
				this.$data[dbFieldName] = dnew;
				db.$constructRelations(this);
				db.$addToIndexes(this);
			}
		}
	});
};

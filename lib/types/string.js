/*jslint node: true */
"use strict";

exports.normalize = function(val) {
	if (typeof val === "undefined") val=null;
	if ((typeof val !== "string") && (val !== null)) {
		val = val.toString();
	}
	return val;
};

exports.createProperty = function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;

	sch.fields[f].size = sch.fields[f].size || 255;
	var dbFieldName = sch.fields[f].dbFieldName;
	Object.defineProperty(cls.prototype, f, {
		get: function () {
			return this.$data[dbFieldName];
		},
		set: function (val) {
			if (val === undefined) val=null;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			val = exports.normalize(val);
			if (val) {
				val = val.substring(0, sch.fields[f].size);
			}
			if (this.$data[dbFieldName] !== val) {
				db.$transaction.addUpdate(this, f, this.$data[dbFieldName], val);
				db.$removeFromIndexes(this);
				db.$destroyRelations(this);
				this.$data[dbFieldName] = val;
				db.$constructRelations(this);
				db.$addToIndexes(this);
			}
		}
	});
};
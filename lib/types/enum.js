/*jslint node: true */
"use strict";

exports.normalize = function(val) {
	return val;
};

exports.createProperty = function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	var dbFieldName = sch.fields[f].dbFieldName;

	Object.defineProperty(cls.prototype, f, {
		get: function () {
			if (!this.$data[dbFieldName]) {
				return null;
			}
			if (sch.fields[f].options.indexOf(this.$data[dbFieldName]) >= 0) {
				return this.$data[dbFieldName];
			}
			return null;
		},
		set: function (val) {
			var V;
			if (val === undefined) val=null;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			V = exports.normalize(val);

			if (val) {
				idx = sch.fields[f].options.indexOf(val);
				if (idx >= 0) {
					V = sch.fields[f].options[idx];
				} else {
					V = null;
				}
			} else {
				V = null;
			}

			if (this.$data[dbFieldName] !== V) {
				db.$transaction.addUpdate(this, f, this.$data[dbFieldName], V);
				db.$removeFromIndexes(this);
				db.$destroyRelations(this);
				this.$data[dbFieldName] = V;
				db.$constructRelations(this);
				db.$addToIndexes(this);
			}
		}
	});
};
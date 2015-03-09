/*jslint node: true */
"use strict";

exports.normalize = function(val) {
	var V;
	if ((typeof val === "undefined") || (val === null)) {
		V = null;
	} else {
		V = val ? 1 : 0;
	}
	return V;
};

exports.booleanNormalize = function(val) {
	var V;
	if ((typeof val === "undefined") || (val === null)) {
		V = null;
	} else {
		V = val ? true : false;
	}
	return V;
};

exports.createProperty = function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	var dbFieldName = sch.fields[f].dbFieldName;

	Object.defineProperty(cls.prototype, f, {
		get: function () {
			var v = exports.booleanNormalize(this.$data[dbFieldName]);
			return v;
		},
		set: function (val) {
			var vOld, vNew;
			if (val === undefined) val=null;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			vOld = exports.normalize(this.$data[dbFieldName]);
			vNew = exports.normalize(val);
			if (vOld != vNew) {
				db.$transaction.addUpdate(this, f, vOld , vNew);
				db.$removeFromIndexes(this);
				db.$destroyRelations(this);
				this.$data[dbFieldName] = vNew;
				db.$constructRelations(this);
				db.$addToIndexes(this);
			}
		}
	});
};
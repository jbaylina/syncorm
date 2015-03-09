/*jslint node: true */
"use strict";

exports.normalize = function(val) {
	var V;
	if (typeof val === "string") {
		val=JSON.parse(val);
	}
	if (val) {
		V = JSON.stringify(val);
	} else {
		V = null;
	}
	return V;
};

exports.createProperty = function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	var dbFieldName = sch.fields[f].dbFieldName;

	Object.defineProperty(cls.prototype, f, {
		get: function () {
			var obj;
			try {
				obj = JSON.parse(this.$data[dbFieldName]);
			} catch (err) {
				obj = null;
			}
			return obj;
		},
		set: function (val) {
			var vOld, vNew;
			if (val === undefined) val=null;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}

			vNew= exports.normalize(val);
			vOld = exports.normalize(this.$data[dbFieldName]);

			if (vOld !== vNew) {
				db.$transaction.addUpdate(this, f, vOld, vNew);
				db.$removeFromIndexes(this);
				db.$destroyRelations(this);
				this.$data[dbFieldName] = vNew;
				db.$constructRelations(this);
				db.$addToIndexes(this);
			}
		}
	});
};
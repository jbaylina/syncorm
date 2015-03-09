/*jslint node: true */
"use strict";

exports.normalize = function(val) {
	var V;
	if ((typeof val === "undefined") || (val === null)) {
		V = null;
	} else {
		V = parseInt(val, 10);
		if (isNaN(V)) {
			V = null;
		}
	}
	return V;
};

exports.createProperty=function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	var dbFieldName = sch.fields[f].dbFieldName;
	Object.defineProperty(cls.prototype, f, {
		get: function () {
			return this.$data[dbFieldName];
		},
		set: function (val) {
			var V;
			if (val === undefined) val=null;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}

			V = exports.normalize(val);
	
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
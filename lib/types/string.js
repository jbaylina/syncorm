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
	Object.defineProperty(cls.prototype, f, {
		get: function () {
			return this.$data[f];
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
			if (this.$data[f] !== val) {
				db.$transaction.addUpdate(this, f, this.$data[f], val);
				db.$removeFromIndexes(this);
				this.$data[f] = val;
				db.$addToIndexes(this);
			}
		}
	});
};
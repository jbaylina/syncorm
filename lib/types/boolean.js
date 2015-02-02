exports.normalize = function(val) {
	var V;
	if ((typeof val === "undefined") || (val === null)) {
		V = null;
	} else {
		V = val ? 1 : 0;
	}
	return V;
};

exports.createProperty = function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	Object.defineProperty(cls.prototype, f, {
		get: function () {
			return (this.$data[f] === null) ? null : (this.$data[f] ? true : false);
		},
		set: function (val) {
			var V;
			if (val === undefined) val=null;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			V = exports.normalize(val);
			if (this.$data[f] !== V) {
				db.$transaction.addUpdate(this, f, this.$data[f], V);
				db.$removeFromIndexes(this);
				this.$data[f] = V;
				db.$addToIndexes(this);
			}
		}
	});
};
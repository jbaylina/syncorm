exports.createProperty=function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	Object.defineProperty(cls.prototype, f, {
		get: function () {
			return this.$data[f];
		},
		set: function (val) {
			var V;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			if ((typeof val === "undefined") || (val === null)) {
				V = null;
			} else {
				V = parseInt(val, 10);
				if (isNaN(V)) {
					V = null;
				}
			}
			if (this.$data[f] !== V) {
				db.$transaction.addUpdate(this, f, this.$data[f], V);
				db.$removeFromIndexes(this);
				this.$data[f] = V;
				db.$addToIndexes(this);
			}
		}
	});
};
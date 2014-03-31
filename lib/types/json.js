exports.createProperty = function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;

	Object.defineProperty(cls.prototype, f, {
		get: function () {
			var obj;
			try {
				obj = JSON.parse(this.$data[f]);
			} catch (err) {
				obj = null;
			}
			return obj;
		},
		set: function (val) {
			var V;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			if (typeof val === "string") {
				val=JSON.parse(val);
			}
			if (val) {
				V = JSON.stringify(val);
			} else {
				V = null;
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
exports.createProperty = function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	Object.defineProperty(cls.prototype, f, {
		get: function () {
			if (!this.$data[f]) {
				return null;
			}
			if (sch.fields[f].options.indexOf(this.$data[f]) >= 0) {
				return this.$data[f];
			}
			return null;
		},
		set: function (val) {
			var idx, V;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
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
			if (this.$data[f] !== V) {
				db.$transaction.addUpdate(this, f, this.$data[f], V);
				db.$removeFromIndexes(this);
				this.$data[f] = V;
				db.$addToIndexes(this);
			}
		}
	});
};
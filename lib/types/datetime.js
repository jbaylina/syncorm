function normalizedDateTime(d) {
	var dt;
	if (d instanceof Date) {
		dt = new Date(d);
		if (isNaN(dt.getTime())) {
			return null;
		}
		dt.setMilliseconds(0);
		return dt;
	} else if (typeof d === "string") {
		dt = new Date(d + "UTC");
		if (isNaN(dt.getTime())) {
			dt = new Date(d);
			if (isNaN(dt.getTime())) {
				return null;
			}
		}
		dt.setMilliseconds(0);
		return dt;
	} else {
		return null;
	}
}


function normalizedStrDateTime(d) {
	var dt;
	dt = normalizedDateTime(d);
	if (!dt) {
		return null;
	}
	return dt.toISOString().slice(0, 19).replace('T', ' ');
}

exports.createProperty = function(db,cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	Object.defineProperty(cls.prototype, f, {
		get: function () {
			return normalizedDateTime(this.$data[f]);
		},
		set: function (val) {
			var dold, dnew;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			dold = normalizedStrDateTime(this.$data[f]);
			dnew = normalizedStrDateTime(val);

			if (dold !== dnew) {
				db.$transaction.addUpdate(this, f, dold, dnew);
				db.$removeFromIndexes(this);
				this.$data[f] = dnew;
				db.$addToIndexes(this);
			}
		}
	});
};
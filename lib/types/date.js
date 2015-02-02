

function normalizedDate(d) {
	var dt;
	if (d instanceof Date) {
		dt = new Date(d);
		if (isNaN(dt.getTime())) {
			return null;
		}
		dt.setMilliseconds(0);
		dt.setHours(0);
		dt.setMinutes(0);
		dt.setSeconds(0);
		return dt;
	} else if (typeof d === "string") {
		dt = new Date(d.slice(0.10));
		if (isNaN(dt.getTime())) {
			return null;
		}
		dt.setMilliseconds(0);
		dt.setHours(0);
		dt.setMinutes(0);
		dt.setSeconds(0);
		return dt;
	} else {
		return null;
	}
}


function normalizedStrDate(v) {
	function fill(n, size) {
		n = n.toString();
		while (n.length < size) {
			n = "0" + n;
		}
		return n;
	}

	var dt, d, m, y;
	dt = normalizedDate(v);
	if (!dt) {
		return null;
	}
	d = dt.getDate();
	m = dt.getMonth() + 1;
	y = dt.getFullYear();

	return fill(y, 4) + "-" + fill(m, 2) + "-" + fill(d, 2);
}

exports.normalize = normalizedStrDate;

exports.createProperty = function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	Object.defineProperty(cls.prototype, f, {
		get: function () {
			return normalizedDate(this.$data[f]);

		},
		set: function (val) {
			var dold, dnew;
			if (val === undefined) val=null;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			dold = normalizedStrDate(this.$data[f]);
			dnew = normalizedStrDate(val);

			if (dold !== dnew) {
				db.$transaction.addUpdate(this, f, dold, dnew);
				db.$removeFromIndexes(this);
				this.$data[f] = dnew;
				db.$addToIndexes(this);
			}
		}
	});
};
exports.createProperty = function(db, cls, f) {
	var sch;
	sch = cls.prototype.$schema;
	if (!sch.fields[f].name) {
		throw new Error("Class: " + sch.name + "Link Property: " + f + " must have a name");
	}
	Object.defineProperty(cls.prototype, f, {
		get: function () {
			return this.$data[f];
		},
		set: function (val) {
			var objTo;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			if (val !== this.$data[f]) {
				if ((val) && (!typeof db.$classes[sch.fields[f].type].prototype.$all[val])) {
					throw new Error("Linking to an object that does not exist");
				}

				if (this.$data[f]) {
					if (sch.fields[f].reverse) {
						objTo = db.$classes[sch.fields[f].type].prototype.$all[this.$data[f]];
						delete objTo.$associations[sch.fields[f].reverse][this[this.$schema.id]];
					}
				}
				if (val) {
					objTo = db.$classes[sch.fields[f].type].prototype.$all[val];
					if (objTo) {
						if (typeof objTo.$associations[sch.fields[f].reverse] === "undefined") {
							objTo.$associations[sch.fields[f].reverse] = {};
						}
						objTo.$associations[sch.fields[f].reverse][this[this.$schema.id]] = this;
					}
				}
				db.$transaction.addUpdate(this, f, this.$data[f], val);
				db.$removeFromIndexes(this);
				this.$data[f] = val;
				db.$addToIndexes(this);
			}
		}
	});
};
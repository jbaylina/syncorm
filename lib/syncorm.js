/*jslint node: true */
"use strict";

var Q = require("q"),
	dbOps = require("./dbops"),
	U = require("underscore"),
	events = require('events');

var types = {
	"boolean": require("./types/boolean.js"),
	"date": require("./types/date.js"),
	"datetime": require("./types/datetime.js"),
	"enum": require("./types/enum.js"),
	"float": require("./types/float.js"),
	"integer": require("./types/integer.js"),
	"json": require("./types/json.js"),
	"link": require("./types/link.js"),
	"string": require("./types/string.js")
};

var drivers = {
	"mysql": require("./drivers/mysql").Driver
};


function createCalculatedField(db, cls, f) {
	var sch, fnget;
	sch = cls.prototype.$schema;

	if (typeof sch.calculatedFields[f] == "function") {
		sch.calculatedFields[f] = {
			get: sch.calculatedFields[f]
		};
	}

	fnget = sch.calculatedFields[f].get;
	if (typeof fnget !== "function") {
		throw new Error("Calculated fields must have a get function");
	}

	Object.defineProperty(cls.prototype, f, {
		get: fnget
	});
}


function createToJSONProperty(db, cls) {
	var sch;
	sch = cls.prototype.$schema;
	if (cls.prototype.toJSONobj) {
		throw new Error("A property toJSON already exist");
	}
	cls.prototype.toJSON = function (selector) {
		var f, field, obj, r, clsr, fieldr, i;

		selector = selector || "PUBLIC";
		obj = {};
		for (f in this.$schema.fields) {
			if (this.$schema.fields.hasOwnProperty(f)) {
				field = this.$schema.fields[f];
				if (field.visibility.indexOf(selector) >= 0) {
					obj[f] = this[f];
				}
				if (this.$associationFields.indexOf(f) >= 0) {
					if (field.expand.indexOf(selector) >= 0) {
						obj[field.name] = this[field.name].toJSON(selector);
					}
				}
			}
		}
		for (r in this.$reverseFields) {
			if (this.$reverseFields.hasOwnProperty(r)) {
				clsr = this.$reverseFields[r].cls;
				fieldr = this.$reverseFields[r].field;
				if (clsr.prototype.$schema.fields[fieldr].reverseExpand.indexOf(selector) >= 0) {
					obj[r] = {};
					for (i in this[r]) {
						if (this[r].hasOwnProperty(i)) {
							obj[i] = this[i].toJSON(selector);
						}
					}
				}
			}
		}
		for (f in this.$schema.calculatedFields) {
			if (this.$schema.calculatedFields.hasOwnProperty(f)) {
				field = this.$schema.calculatedFields[f];
				if (field.visibility.indexOf(selector) >= 0) {
					obj[f] = this[f];
				}
			}
		}
		return obj;
	};
}

function createUpdateProperty(db, cls) {
	var sch;
	sch = cls.prototype.$schema;
	if (cls.prototype.update) {
		throw new Error("A property update already exist");
	}
	Object.defineProperty(cls.prototype, "update", {
		value: function (obj) {
			var f;
			for (f in obj) {
				if (obj.hasOwnProperty(f)) {
					if (this.$schema.fields.hasOwnProperty(f)) {
						this[f] = obj[f];
					}
				}
			}
		}
	});
}


function createRemoveProperty(db, cls) {
	var sch;
	sch = cls.prototype.$schema;
	if (cls.prototype.remove) {
		throw new Error("A property delete already exist");
	}
	Object.defineProperty(cls.prototype, "remove", {
		value: function () {
			var f, i;

			for (f in this.$reverseFields) {
				if (this.$reverseFields.hasOwnProperty(f)) {
					if ((Object.keys(this[f]).length > 0)&&(!db.$rollingBack)) {
						throw new Error("this Object is referenced. Class: " + this.$schema.name +
							" id: " + this[this.$schema.id] +
							" reverse: " + f);
					}
				}
			}
			for (i = 0; i < this.$associationFields.length; i += 1) {
				f = this.$associationFields[i];
				this[f] = null;
			}
			db.$transaction.addDelete(this);
			db.$removeFromIndexes(this);

			delete this.$all[this[this.$schema.id]];
		}
	});
}

exports.Database = function(params) {

	var self;
	self = this;
	this.$classes = {};
	this.$indexes = {};

	this.$transactionRequestQueue = [];
	this.$transaction = null;
	this.$rollingBack = false;
	this.$initialized = false;
	this.$driver = new drivers[params.driver](params);

	this.$removeFromIndexes = function() {

	};

	this.$addToIndexes = function() {

	};



	this.define = function (sch) {

		var field, cls, index;

		if (typeof sch.table !== "string") {
			throw new Error("You mus specify a table name");
		}

		if (typeof sch.id !== "string") {
			sch.id = "id";
		}

		if (!sch.name) {
			throw new Error("You must specify a name (class name) in the schema");
		}

		if (this.$classes[sch.name] !== undefined) {
			throw new Error("Class name already defined" + sch.name);
		}

		if (this.hasOwnProperty(sch.name)) {
			throw new Error("Invalid name: " + sch.name);
		}

		if (this.hasOwnProperty(sch.table)) {
			throw new Error("Invalid table name (might be repeated): " + sch.table);
		}

		sch.calculatedFields = sch.calculatedFields || {};


		cls = function (a, b) {
			var f, field;

			this.$associations = {};
			if ((arguments.length === 2) && (a === "loaddirect")) {
				this.$data = b;
				return this;
			}

			this.$data = {};
			a = a || {};


			// First put the id
			f = this.$schema.id;
			field = this.$schema.fields[f];
			if ((a[f] === undefined) || (a[f] === null)) {
				if (typeof field.def === "function") {
					this.$data[f] = field.def();
				} else {
					this.$data[f] = field.del;
				}
			} else {
				this.$data[f] = a[f];
			}

			if (this.$all[this[this.$schema.id]]) {
				throw new Error("This object already exist");
			}

			this.$all[this[this.$schema.id]] = this;

			self.$transaction.addInsert(this);

			// then put the rest of fields
			for (f in this.$schema.fields) {
				if ((this.$schema.fields.hasOwnProperty(f)) && (f !== this.$schema.id)) {
					field = this.$schema.fields[f];
					if ((a[f] === undefined) || (a[f] === null)) {
						if (typeof field.def === "function") {
							this[f] = field.def();
						} else {
							this[f] = field.def;
						}
					} else {
						this[f] = a[f];
					}
				}
			}


			if (this.onInit) {
				this.onInit(a);
			}

			self.$addToIndexes(this);

			return this;
		};

		self.$classes[sch.name] = cls;
		cls.prototype.$schema = sch;
		cls.prototype.$associationFields = [];
		cls.prototype.$reverseFields = {};
		cls.prototype.$all = {};
		self[sch.name] = cls;
		self[sch.table] = cls.prototype.$all;
		for (field in sch.fields) {
			if (sch.fields.hasOwnProperty(field)) {
				if (typeof sch.fields[field] === "string") {
					sch.fields[field] = {
						type: sch.fields[field]
					};
				}
				if (sch.fields[field].visibility === undefined) {
					sch.fields[field].visibility = ["PUBLIC"];
				}
				if (sch.fields[field].def === undefined) {
					sch.fields[field].def = null;
				}
				if (!sch.fields[field].type) {
					throw new Error("Field " + field + " must have a type");
				} else if (types[sch.fields[field].type]) {
					types[sch.fields[field].type].createProperty(self, cls, field);
				} else {
					if (sch.fields[field].expand === undefined) {
						sch.fields[field].expand = [];
					}
					if (sch.fields[field].reverseExpand === undefined) {
						sch.fields[field].reverseExpand = [];
					}
					self.$classes[sch.name].prototype.$associationFields.push(field);
					types.link.createProperty(self, self.$classes[sch.name], field);
				}
			}
		}
		U.each(sch.calculatedFields, function(calculatedField, field) {
			if (calculatedField.visibility === undefined) {
				calculatedField.visibility = ["PUBLIC"];
			}
			createCalculatedField(self, cls, field);
		});
		U.each(sch.indexes, function(index, indexName) {
				self.define_index(indexName, sch.name, index);
		});
		U.each(sch.methods, function(fnMethod, methoName) {
			if (cls.prototype[methoName] !== undefined) {
				throw new Error("Method " + methoName + " already defined in class "+ sch.name);
			}
			cls.prototype[methoName] = fnMethod;
		});
		createUpdateProperty(self, cls);
		createRemoveProperty(self, cls);
		createToJSONProperty(self, cls);

		return cls;
	};

	this.define_index = function (indexName, className, indexFunction) {
		var idx = {
			name: indexName,
			className: className,
			indexFunction: indexFunction
		};

		self.$indexes[indexName] = idx;
	};





	this.loaded = false;
	this.loadAll = function (onInit) {


		function prepareAssociation(cls, field) {
			var to, objId, name, reverse;
			if (!self.$classes[cls.prototype.$schema.fields[field].type]) {
				throw new Error("Type not defined: " + cls.prototype.schema[field].type + " for field " + field);
			}
			to = self.$classes[cls.prototype.$schema.fields[field].type];
			name = cls.prototype.$schema.fields[field].name;
			if (cls.prototype.hasOwnProperty(name)) {
				throw new Error("Name already in use " +
					" name: " + name +
					" class: " + cls.toString() +
					" field: " + field);
			}
			reverse = cls.prototype.$schema.fields[field].reverse;
			if (reverse) {
				if (to.prototype.hasOwnProperty(reverse)) {
					throw new Error("Name already in use " +
						" reverse: " + reverse +
						" class: " + to.toString());
				}
			}

			Object.defineProperty(cls.prototype, name, {
				get: function () {
					if (this.$data[field]) {
						return to.prototype.$all[this.$data[field]];
					} else {
						return null;
					}
				}
			});

			if (reverse) {
				to.prototype.$reverseFields[reverse] = {
					cls: cls,
					field: field,
					reverse: reverse
				};
				Object.defineProperty(to.prototype, reverse, {
					get: function () {
						if (!this.$associations[reverse]) {
							this.$associations[reverse] = {};
						}
						return this.$associations[reverse];
					}
				});
			}
		}

		function constructAssociation(From, field) {
			var To, objFromId, objFrom, objTo, reverse;
			if (!self.$classes[From.prototype.$schema.fields[field].type]) {
				throw new Error("Type not defined: " + From.prototype.$schema.fields[field].type +
					" for field " + field);
			}
			To = self.$classes[From.prototype.$schema.fields[field].type];
			U.each(From.prototype.$all, function(objFrom) {
					if (objFrom[field]) {
						if (To.prototype.$all[objFrom[field]] === undefined) {
							console.log("Invalid reference: " +
								" class: " + From.prototype.$schema.name +
								" Object id: " + objFromId +
								" Field: " + field +
								" value: " + objFrom[field]);
						} else {
							objTo = To.prototype.$all[objFrom[field]];
							reverse = From.prototype.$schema.fields[field].reverse;

							if (reverse) {
								if (objTo.$associations[reverse] === undefined) {
									objTo.$associations[reverse] = {};
								}
								objTo.$associations[reverse][objFrom[objFrom.$schema.id]] = objFrom;
							}
						}
					}
			});
		}

		function loadAllObjects(q, Cls, connection) {

			return self.$driver.getAll(Cls.prototype.$schema.table,
					Object.keys(Cls.prototype.$schema.fields),
					Cls.prototype.$schema.condition)
				.then(function (rows) {
					U.each(rows, function(row) {
						Cls.prototype.$all[row[Cls.prototype.$schema.id]] = new Cls("loaddirect", row);
					});
				});
		}

		function construnctIndex(q, indexName) {
			return q.then(function () {
				var index = self.$indexes[indexName],
					k,
					obj;
				if (self[indexName] !== undefined) {
					throw new Error("Index " + indexName + " name conflict");
				}

				self[indexName] = {};
				U.each(self.$classes[index.className].prototype.$all, function(obj) {
						k = index.indexFunction(obj);

						if (self[indexName][k] === undefined) {
							self[indexName][k] = [];
						}
						self[indexName][k].push(obj);
				});
			});
		}





		var i, clsname, cls, q, from, to, field, indexname;

		q = new Q();

		if (self.$loaded) {
			return new Q();
		}


		U.each(self.$classes, function(from) {
			U.each(from.prototype.$associationFields, function(field) {
				prepareAssociation(from, field);
			});
		});


		U.each(self.$classes, function(cls) {
			q = loadAllObjects(q, cls);
		});

		q = q.then(function () {
			var clsname, from, to, field;
			U.each(self.$classes, function(from) {
				U.each(from.prototype.$associationFields, function(field) {
						constructAssociation(from, field);
				});
			});
		});


		U.each(self.$indexes, function(i, indexname) {
				q = construnctIndex(q, indexname);
		});

		if (onInit) {
			q = q.then(onInit);
		}
		q = q.then(function () {
			self.$initialized = true;
			self.$events.emit('init');
		});
		return q;
	};



	this.$processQueue = function() {
		var defered;
		if (!this.$initialized) {
			return;
		}
		if (this.$transaction) {
			return;
		}
		if (this.$transactionRequestQueue.length === 0) {
			return;
		}
		defered = this.$transactionRequestQueue.shift();
		this.$transaction = new dbOps.Transaction(self);
		defered.resolve();
	};

	this.startTransaction = function () {
		var defered = new Q.defer();
		this.$transactionRequestQueue.push(defered);
		this.$processQueue();
		return defered.promise;
	};

	this.rollback = function () {
		if (!this.$transaction) {
			return;
		}
		this.$rollingBack =true;
		return this.$transaction.rollback()
			.then(function() {
				self.$transaction = null;
				self.$rollingBack = false;
				self.$processQueue();
			});
	};

	this.commit = function () {
		var self2=this;
		return this.$transaction.commit()
			.fin(function () {
				self2.$transaction = null;
				self2.$processQueue();
			});
	};

	this.$events = new events.EventEmitter();
	this.on = function (ev, fn) {
		return self.$events.on(ev, fn);
	};

};
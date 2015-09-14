/*jslint node: true */
"use strict";


var dbOps = require("./dbops"),
	U = require("lodash"),
	async = require("async"),
	pluralize = require('pluralize'),
	uuid = require('node-uuid'),
	events = require('events'),
	mk = require('./mk.js');

exports.mk = mk;

var types = {
	"boolean": require("./types/boolean.js"),
	"date": require("./types/date.js"),
	"datetime": require("./types/datetime.js"),
	"enum": require("./types/enum.js"),
	"float": require("./types/float.js"),
	"integer": require("./types/integer.js"),
	"json": require("./types/json.js"),
	"string": require("./types/string.js")
};

var drivers = {
	"mysql": require("./drivers/mysql").Driver
};



function createFieldProperty(db, cls, f, db2js, js2db) {
		var sch;
	sch = cls.prototype.$schema;
	var dbFieldName = sch.fields[f].dbFieldName;

	Object.defineProperty(cls.prototype, f, {
		get: function () {
			var v = db2js(this.$data[dbFieldName], sch.fields[f]);
			if (typeof sch.fields[f].getter  === "function") {
				v = sch.fields[f].getter.call(this, v, f);
			}
			return v;
		},
		set: function (val) {
			var vOld, vNew;
			if (typeof sch.fields[f].setter  === "function") {
				val = sch.fields[f].setter.call(this, val, f);
			}
			if (val === undefined) val=null;
			if (db.$transaction === null) {
				throw new Error("Value modified outside a transaction");
			}
			vOld = js2db(db2js(this.$data[dbFieldName], sch.fields[f]), sch.fields[f]);
			vNew = js2db(val, sch.fields[f]);
			if (vOld != vNew) {
				db.$transaction.addUpdate(this, f, vOld , vNew);
				db.$callRemoveTriggers(this);
				db.$destroyRelations(this);
				this.$data[dbFieldName] = vNew;
				db.$constructRelations(this);
				db.$callAddTriggers(this);
			}
		}
	});
}


function createCalculatedField(db, cls, f) {
	var sch, fnget;
	sch = cls.prototype.$schema;

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
		var f, field, r, clsr, fieldr, i;

		var self = this;

		selector = selector || "PUBLIC";
		var obj = {k : 1};
		delete obj.k; // trick v8 not to use hidden class

		U.each(self.$schema.fields, function(field, f) {
			if (field.visibility.indexOf(selector) >= 0) {
				obj[f] = self[f];
			}
		});
		U.each(self.$schema.calculatedFields, function(field, f) {
			if (field.visibility.indexOf(selector) >= 0) {
				obj[f] = self[f];
			}
		});
		U.each(self.$schema.relations, function(relation, f) {
			if (relation.visibility.indexOf(selector) >= 0) {
				obj[f] = self[f].toJSON(selector);
			}
		});
		U.each(self.$schema.reverseRelations, function(reverseRelation, f) {
			if (reverseRelation.visibility.indexOf(selector) >= 0) {
				obj[f] = {};
				mk.each(self[f], reverseRelation.cls.prototype.$schema.id.length, function(relobj, key) {
					mk.set(obj[f], key, relobj.toJSON());
				});
			}
		});
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
			var self = this;
			db.$callRemoveTriggers(self);
			db.$destroyRelations(self);
			db.$lockRelations = true;
			U.each(obj, function(val, f) {
				if (self.$schema.fields.hasOwnProperty(f)) {
					self[f] = obj[f];
				}
			});
			db.$lockRelations=false;
			db.$constructRelations(self);
			db.$callAddTriggers(self);
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
			db.$callRemoveTriggers(this);
			db.$destroyRelations(this);
			db.$transaction.addDelete(this);

			mk.delete(this.$all, this.$key);
		}
	});
}

function createKeyProperty(db, cls) {
	var sch;
	sch = cls.prototype.$schema;
	if (cls.prototype.$key) {
		throw new Error("A property $key already exist");
	}
	if (cls.prototype.$keyStr) {
		throw new Error("A property $keyStr already exist");
	}
	Object.defineProperty(cls.prototype, "$keyStr", {
		get: function () {
			var key="";
			var i;
			for (i=0; i<sch.id.length; i++) {
				if (i>0) key = key + "|";
				key = key + this[sch.id[i]];
			}
			return key;
		}
	});
	Object.defineProperty(cls.prototype, "$key", {
		get: function () {
			var key=[];
			var i;
			for (i=0; i<sch.id.length; i++) {
				key.push(this[sch.id[i]]);
			}
			return key;
		}
	});
}

exports.Database = function(params) {

	var self;
	self = this;
	this.$classes = {};

	this.$transactionRequestQueue = [];
	this.$transaction = null;
	this.$rollingBack = false;
	this.$initialized = false;

	params.dbOpsUser = params.dbOpsUser || uuid.v1();
	this.dbOpsUser = params.dbOpsUser;

	if (!params.log) {
		this.$log = function() {};
	} else if (params.log === true) {
		this.$log= function(level, msg) {
			console.log(level+ ": "+msg);
		};
	} else if (typeof params.log === "function") {
		this.$log = params.log;
	} else {
		this.$log = function() {};
	}


	this.$driver = new drivers[params.driver](params, this.$log);
	this.$synchronize = !!params.synchronize;

	this.$deleteOldDbOps = params.deleteOldDbOps;
	if (typeof params.deleteOldDbOps === "undefined") {
		this.$deleteOldDbOps = this.$synchronize;
	}
	this.$timeLastDeleteOldOps =0;

	this.$callAddTriggers = function(obj) {
		if (self.$lockRelations) return;
		U.each(obj.$triggers, function(trigger) {
			trigger.add(obj);
		});
	};

	this.$callRemoveTriggers = function(obj) {
		if (self.$lockRelations) return;
		U.each(obj.$triggers, function(trigger) {
			trigger.remove(obj);
		});
	};

	this.define = function (sch) {

		var field, cls, index;

		if (typeof sch.table !== "string") {
			throw new Error("You mus specify a table name");
		}

		sch.dbTableName = sch.dbTableName || sch.table;

		sch.dbTableName = sch.dbTableName || sch.table || pluralize.plural(sch.name.toLowerCase());

		if (typeof sch.id === "string") {
			sch.id = [sch.id];
		}

		if ( ! (sch.id instanceof Array)) {
			sch.id = ["id"];
		}

		U.each(sch.id, function(f) {
			if (!sch.fields[f]) {
				throw new Error("Field key does not exist. class: " + sch.name + " fieldName: "+ f);
			}
		});

		if (!sch.name) {
			throw new Error("You must specify a name (class name) in the schema");
		}

		if (this.$classes[sch.name] !== undefined) {
			throw new Error("Class name already defined: " + sch.name);
		}

		if (this.hasOwnProperty(sch.name)) {
			throw new Error("Invalid name: " + sch.name);
		}

		if (this.hasOwnProperty(sch.table)) {
			throw new Error("Invalid table name (might be repeated): " + sch.table);
		}

		sch.calculatedFields = sch.calculatedFields || {};
		sch.reverseRelations = {};


		cls = function (a, b) {
			var f, field;

			var self2 = this;

			self2.$relations = {};
			self2.$reverseRelations = {};

			U.each(self2.$schema.reverseRelations, function(revRel, revRelName) {
				self2.$reverseRelations[revRelName] = {};
			});

			if ((arguments.length === 2) && (a === "loaddirect")) {
				self2.$data = b;
				return self2;
			}

			self2.$data = {};
			a = a || {};

			self.$lockRelations = true;

			// First put the key fields
			U.each(self2.$schema.id , function(f) {
				field = self2.$schema.fields[f];
				if ((a[f] === undefined) || (a[f] === null)) {
					if (typeof field.def === "function") {
						self2.$data[field.dbFieldName] = field.def();
					} else {
						self2.$data[field.dbFieldName] = field.def;
					}
				} else {
					self2.$data[field.dbFieldName] =  field.$type.js2db(a[f], field);
				}
			});

			if (mk.get(self2.$all, self2.$key)) {
				throw new Error("This object already exist: Schema: " + self2.$schema.name + " Key: "+self2.$keyStr);
			}

			mk.set(self2.$all,self2.$key,self2);

			self.$transaction.addInsert(self2);

			// then put the rest of fields
			U.each(self2.$schema.fields, function(field, f) {
				if (!U.contains(self2.$schema.id, f)) {
					if ((a[f] === undefined) || (a[f] === null)) {
						if (typeof field.def === "function") {
							self2[f] = field.def();
						} else {
							self2[f] = field.def;
						}
					} else {
						self2[f] = a[f];
					}
				}
			});

			self.$lockRelations = false;

			self.$constructRelations(self2);

			if (self2.onInit) {
				self2.onInit(a);
			}

			self.$callAddTriggers(self2);

			Object.seal(self2);

			return self2;
		};

		self.$classes[sch.name] = cls;
		cls.prototype.$schema = sch;
		cls.prototype.$all = {};
		cls.prototype.$orphans = {};
		cls.prototype.$db = self;
		cls.prototype.$triggers = [];
		self[sch.name] = cls;
		self[sch.table] = cls.prototype.$all;

		U.each(sch.fields, function(field, fieldName) {
				if (typeof field === "string") {
					field = {
						type: field
					};
					sch.fields[fieldName] = field;
				}

				field.visibility = field.visibility || ["PUBLIC"];
				field.def = field.def || null;
				field.dbFieldName = field.dbFieldName || fieldName;

				if (types[field.type]) {
					createFieldProperty(self, cls, fieldName, types[field.type].db2js, types[field.type].js2db );
//					types[field.type].createProperty(self, cls, fieldName);
					field.$type = types[field.type];
				} else {
					throw new Error("Invalid Type. Class: " + sch.name + " Field: " + fieldName + " Type: " + field.type);
				}
		});

		U.each(sch.relations, function(rel, relname) {
			rel.visibility = rel.visibility || [];
			rel.reverseVisibility = rel.reverseVisibility || [];

			if (!rel.link) {
				throw new Error("Relation " + relname + ": no link defined");
			}

			if (typeof rel.link === "string") {
				rel.link = [rel.link];
			}
			cls.prototype.$orphans[relname] = {};
		});

		U.each(sch.calculatedFields, function(calculatedField, field) {
			if (typeof calculatedField === "function") {
				sch.calculatedFields[field] = calculatedField = {
					get: calculatedField
				};
			}
			if (typeof calculatedField.visibility === "undefined") {
				calculatedField.visibility = ["PUBLIC"];
			}
			createCalculatedField(self, cls, field);
		});
		if (sch.triggers && (!(sch.triggers instanceof Array))) {
			sch.triggers = [sch.triggers];
		}
		U.each(sch.triggers, function(trigger) {
			self.addTrigger(cls, trigger);
		});
		U.each(sch.methods, function(fnMethod, methoName) {
			if (cls.prototype[methoName] !== undefined) {
				throw new Error("Method " + methoName + " already defined in class "+ sch.name);
			}
			cls.prototype[methoName] = fnMethod;
		});
		createKeyProperty(self,cls);
		createUpdateProperty(self, cls);
		createRemoveProperty(self, cls);
		createToJSONProperty(self, cls);

		return cls;
	};

	this.addTrigger = function(cls, trigger) {
		var sch=cls.prototype.$schema;
		if (typeof trigger !== "object") {
				throw new Error("Trigger must be an object with an add and a remove method. Class: " + sch.name);
		}
		if (typeof trigger.add !== "function") {
				throw new Error("Trigger 'add' is not a function. Class: " + sch.name + " Trigger: ");
		}
		if (typeof trigger.remove !== "function") {
				throw new Error("Trigger 'remove' is not a function. Class: " + sch.name + " Trigger: ");
		}
		cls.prototype.$triggers.push(trigger);
	};

	this.loadAll = function (callback) {


		function prepareRelation(cls, relName) {
			var to, objId, reverse, rel;
			rel =cls.prototype.$schema.relations[relName];
			to = self.$classes[rel.type];
			if (!to) {
				throw new Error("Class not defined. " +
					" class: " + cls.prototype.$schema.name +
					" relation: " + relName +
					" type: " + rel.type);
			}
			if (cls.prototype.hasOwnProperty(relName)) {
				throw new Error("Name already in use " +
					" relation: " + relName +
					" class: " + cls.toString());
			}
			if (rel.reverse) {
				if (to.prototype.hasOwnProperty(rel.reverse)) {
					throw new Error("Name already in use " +
						" reverse: " + rel.reverse +
						" classFrom: " + cls.prototype.$schema.name +
						" classTo: " + to.prototype.$schema.name);
				}
			}

			Object.defineProperty(cls.prototype, relName, {
				get: function () {
					return this.$relations[relName] || null;
				}
			});

			if (rel.reverse) {
				to.prototype.$schema.reverseRelations[rel.reverse] = {
					cls: cls,
					relation: relName,
					visibility: rel.reverseVisibility
				};
				Object.defineProperty(to.prototype, rel.reverse, {
					get: function () {
						return this.$reverseRelations[rel.reverse];
					}
				});
			}
		}

		function loadAllObjects(Cls, cb) {
			self.$driver.getAll(
				Cls.prototype.$schema.dbTableName,
				U.map(Cls.prototype.$schema.fields, function(f) {
					return f.dbFieldName;
				}),
				Cls.prototype.$schema.condition,
				function(err, rows) {
					if (err) return cb(err);
/*					U.each(rows, function(row) {
						var o = new Cls("loaddirect", row);
						mk.set(Cls.prototype.$all,o.$key,o);
					});
					cb(); */

					var i=0;
					async.eachLimit(rows, 500, function(row, cb) {
						if (i%1000 === 0)
							self.$log("debug", Cls.prototype.$schema.name+ " "+i);
						i+=1;
						var o = new Cls("loaddirect", row);
						mk.set(Cls.prototype.$all,o.$key,o);
						U.defer(cb);
					}, cb);
				});
		}

		function extratLastDbOpId(cb) {
			if (!self.$synchronize) {
				return U.defer(cb);
			}
			self.$driver.pool.query("SELECT MAX(id) as maxId from dbops", function(err, rows) {
				if (err) return cb(err);
				self.lastDbOpsId = rows[0] ? (rows[0].maxId || 0) : 0;
				cb();
			});
		}

		if (!callback) callback = function() {};



		extratLastDbOpId(function(err, maxDbOpId) {
			U.each(self.$classes, function(cls) {
				U.each(cls.prototype.$schema.relations, function(rel, relName) {
					prepareRelation(cls, relName);
				});
			});

			async.each(Object.keys(self.$classes) , function(className, cb) {
				var cls=self.$classes[className];
				loadAllObjects(cls, cb);
			}, function(err) {
				if (err) return callback(err);

				U.each(self.$classes, function(cls) {
					mk.each(cls.prototype.$all, function(obj) {
						self.$constructRelations(obj);
					});
				});

				U.each(self.$classes, function(cls) {
					mk.each(cls.prototype.$all, function(obj) {
						self.$callAddTriggers(obj);
					});
				});

				setImmediate(function() {
					self.$initialized = true;
					if (callback) {
						callback();
					}

					self.$log('verbose', 'Load Terminated');
					self.$events.emit('init');
				});
			});
		});
	};

	this.$constructRelations = function(obj) {
		if (self.$lockRelations) return;
		U.each(obj.$schema.relations, function(rel, relName) {
			var k=[];
			var toCls = self.$classes[rel.type];
			U.each(rel.link, function(f) {
				k.push(obj[f]);
			});
			var toObj = mk.get(toCls.prototype.$all,k);
			if (toObj) {
				obj.$relations[relName] = toObj;
				if (rel.reverse) {
					mk.delete(obj.$orphans[relName],k);
					mk.set(toObj.$reverseRelations[rel.reverse], obj.$key, obj);
				}
			} else {
				if (rel.reverse) {
					if (!mk.get(obj.$orphans[relName],k)) mk.set(obj.$orphans[relName],k, {});
					mk.set(mk.get(obj.$orphans[relName],k),obj.$key, obj);
				}
			}
		});
		U.each(obj.$schema.reverseRelations, function(revRel, revRelName) {
			var orphans = mk.get(revRel.cls.prototype.$orphans[revRel.relation],obj.$key);
			if (orphans) {
				mk.each(orphans, function(orphan, k) {
					mk.set(obj.$reverseRelations[revRelName],orphan.$key ,orphan);
					orphan.$relations[revRel.relation] = obj;
					mk.delete(revRel.cls.prototype.$orphans[revRel.relation],obj.$key);
				});
			}
		});
	};

	this.$destroyRelations = function(obj) {
		if (self.$lockRelations) return;
		U.each(obj.$schema.reverseRelations, function(revRel, revRelName) {
			mk.each(obj.$reverseRelations[revRelName], function(fromObj) {
				if (!mk.get(fromObj.$orphans[revRel.relation],obj.$key)) {
					mk.set(fromObj.$orphans[revRel.relation],obj.$key, {});
				}
				mk.set(mk.get(fromObj.$orphans[revRel.relation],obj.$key),fromObj.$key,fromObj);
				delete fromObj.$relations[revRel.relation];
			});
		});
		U.each(obj.$schema.relations, function(rel, relName) {
			var toObj = obj.$relations[relName];
			if ((toObj)&&(rel.reverse)) {
				mk.delete(toObj.$reverseRelations[rel.reverse],obj.$key);
			}
		});
		U.each(obj.$schema.reverseRelations, function(revRel, revRelName) {
			obj.$reverseRelations[revRelName] = {};
		});
		obj.$relations = {};
	};



	this.$processQueue = function() {
		var cb;
		if (!this.$initialized) {
			return;
		}
		if (this.$transaction) {
			return;
		}
		if (this.$transactionRequestQueue.length === 0) {
			return;
		}
		cb = this.$transactionRequestQueue.shift();
		this.$transaction = new dbOps.Transaction(self);
		cb();
	};

	this.$startTransaction = function (cb, transactionLog) {
		this.$transactionRequestQueue.push(cb);
		this.$processQueue();
	};

	this.$refreshDbQueue = [];
	this.$forUpdate = false;
	self.$refreshing = false;
	this.$processRefreshQueue = function() {
		var cb;
		if (!this.$initialized) {
			return;
		}
		if (this.$refreshing) {
			return;
		}
		if (this.$refreshDbQueue.length === 0) {
			return;
		}

		var self = this;

		self.$refreshing = true;
		var retCb = self.$refreshDbQueue;
		var forUpdate = self.$forUpdate;
		self.$refreshDbQueue = [];
		self.$forUpdate = false;

		this._refreshDatabase({forUpdate: forUpdate}, function(err) {
			retCb.forEach(function(cb) {
				cb(err);
			});
			self.$refreshing = false;
			U.defer(function() {
				self.$processRefreshQueue();
			});
		});
	};

	this.refreshDatabase = function(forUpdate, cb) {
		if (!self.$synchronize) {
			return U.defer(cb);
		}
		if (typeof forUpdate === "function") {
			cb =forUpdate;
			forUpdate =false;
		}

		if (forUpdate) {
			this.$forUpdate = true;
		}
		this.$refreshDbQueue.push(cb);
		this.$processRefreshQueue();
	};

	this.$events = new events.EventEmitter();
	this.on = function (ev, fn) {
		return self.$events.on(ev, fn);
	};

	this.doTransaction = function(transactionFunction, cb, transactionLog) {
		var self = this;

		var log = self.extendLog(transactionLog);

		function rollbackAndReturnError(err, cb2) {
			self.$driver.rollback(function(err2) {
				self.$transaction.rollback(function(err3) {
						self.$transaction = null;
						cb(err);
						self.$processQueue();
				});
			});
		}

		self.$startTransaction(function(err) {
			self.$driver.startTransaction(function(err) {
				if (err) return cb(err);
				self.refreshDatabase(true, function(err) {
					if (err) return rollbackAndReturnError(err, cb);
					try {
						transactionFunction();
					} catch (err2) {
						return rollbackAndReturnError(err2, cb);
					}
					self.$transaction.execOps(function (err) {
						if (err) return rollbackAndReturnError(err, cb);
						self.$driver.commit(function(err) {
							if (err) return rollbackAndReturnError(err, cb);
							self.$transaction = null;
							U.defer(cb);
							self.$processQueue();
						});
					});
				});
			}, log);
		});
	};

	this._getClassNameFromTableName = function(dbTableName) {

		var cls = U.find(self.$classes, function(cls) {
			if (cls.prototype.$schema.dbTableName === dbTableName) {
				return true;
			}
		});

		if (cls) {
			return cls.prototype.$schema.name;
		} else {
			return null;
		}
	};

	this._refreshDatabase = function(opts, cb) {
		if (!self.$synchronize) {
			return U.defer(cb);
		}
		function getKeyCondition(id, key) {
			var values = key;
			var S = "";
			for (var i=0; i< id.length; i+= 1) {
				if (S!=="") S += " AND ";
				S += self.$driver.escapeId(id[i])  + " = " + self.$driver.escape(values[i]);
			}
			return " ( " + S + " ) ";
		}

		self.$driver.getAll('dbops',
			['id', 'table', 'op', 'key'],
			"id > " +self.lastDbOpsId + " AND ((user <> '" + self.dbOpsUser + "') OR (user is null))",
			opts,
			function(err, rowsss) {
//				console.log("rowss: " + JSON.stringify(rowsss));
				if (err) return cb(err);
				rowsss.sort(function(a,b) {
					return a.id - b.id;
				});
				var deleteOldDbOps = false;
				async.eachSeries(rowsss, function(row, cb2) {
					if (row.id > self.lastDbOpsId) {
						self.lastDbOpsId = row.id;
						deleteOldDbOps = true;
					}
					row.clsName = self._getClassNameFromTableName(row.table);
					row.key = row.key.split('|');
					if (!row.clsName) return U.defer(cb2);
					var sch = self[row.clsName].prototype.$schema;

					// Normalize key values
					U.each(sch.id, function(f, idx) {
						var field = sch.fields[f];
 						row.key[idx] = field.$type.db2js(row.key[idx], field);
					});

					if ((row.op === "UPDATE") || (row.op === "INSERT")) {
						var keyCondition = getKeyCondition(U.map(sch.id , function(f) { return sch.fields[f].dbFieldName;}), row.key);

						self.$driver.getAll(
							sch.dbTableName,
							U.map(sch.fields, function(f) {
								return f.dbFieldName;
							}),
							keyCondition,
							function(err, rows2) {
								if (err) return cb2(err);
//								console.log("row: " + JSON.stringify(row) +  "  result: " + JSON.stringify(rows2));
								if (rows2.length !== 1) return cb2();
								row.obj = {};
								U.forEach(sch.fields, function(f, fn) {
									row.obj[fn] = rows2[0][f.dbFieldName];
								});
								cb2();
							});
					} else {
						U.defer(cb2);
					}
				}, function(err) {
					var oldTransaction = self.$transaction;
					self.$transaction = new dbOps.Transaction(self);
					U.each(rowsss, function(row) {
						if (row.clsName) {
							var sch = self[row.clsName].prototype.$schema;
							if (row.op === "INSERT") {
								self.$log("debug", row.id +" insert: " + JSON.stringify(row.obj));
								if ((row.obj)&&(!mk.get(self[sch.table],row.key))) {
									var tmp = new self[sch.name](row.obj);
								}
							} else if (row.op === "UPDATE") {
								self.$log("debug", row.id +" update: " + JSON.stringify(row.obj));
								if ((row.obj)&&(mk.get(self[sch.table],row.key))) {
									mk.get(self[sch.table],row.key).update(row.obj);
								}
							} else if (row.op === "DELETE") {
								self.$log("debug", row.id +" delete: " + row.key);
								if (mk.get(self[sch.table],row.key)) {
									mk.get(self[sch.table],row.key).remove();
								}
							}
						}
					});
					self.$transaction = oldTransaction;
					if ((self.$deleteOldDbOps)&&(deleteOldDbOps)&&( (new Date().getTime()) - self.$timeLastDeleteOldOps > 60000)) {
						self.$timeLastDeleteOldOps = (new Date().getTime());
						var lastOp = self.lastDbOpsId;
						U.defer(function() {
							self.$driver.deleteOldDbOps(lastOp, function(err) {
								if (err) {
									self.$log("error", "Error deleting dbOps: " + err);
								} else {
									self.$log("debug", "deleting old dbOps Ok");
								}
							});
						});
					}
					U.defer(cb);
				});
			});
	};

	this.extendLog = function(log) {
		if (!log) log = this.$log;
		return function(level, msg, meta) {
			meta = U.extend(meta, {
				module: 'syncorm'
			});
			log(level, msg, meta);
		};
	};

	return this;

};

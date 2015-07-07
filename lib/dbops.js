/*jslint node: true */
"use strict";

var U = require("underscore");
var async = require("async");
var mk = require("./mk.js");



function db2js(schema, obj) {


	var temp = {};

	U.each(schema.fields, function(field, fieldName) {
		var v = obj[field.dbFieldName];
		if (typeof v !== "undefined") {
			temp[fieldName] = v;
		}
	});

	return temp;
}

function js2db(obj) {

	var schema = obj.$schema;
	var temp = {};

	U.each(schema.fields, function(val, fieldName) {
		var v = schema.fields[fieldName].$type.js2db(obj[fieldName]);
		if (v !== null) {
			temp[schema.fields[fieldName].dbFieldName] = v;
		}
	});

	return temp;
}

var DbOp = function (action, obj, fieldName, oldValue, newValue) {
	this.action = action;
	this.obj = obj;
	if (action === "insert") {
		this.oldValues = null;
		this.newValues = js2db(obj);
	} else if (action === "delete") {
		this.oldValues = js2db(obj);
		this.newValues = null;
	} else if (action === "update") {
		this.oldValues = {};
		this.newValues = {};

		if (oldValue === newValue) {
			return this;
		}

		this.oldValues[obj.$schema.fields[fieldName].dbFieldName] = obj.$schema.fields[fieldName].$type.js2db(oldValue);
		this.newValues[obj.$schema.fields[fieldName].dbFieldName] = obj.$schema.fields[fieldName].$type.js2db(newValue);
	} else {
		throw new Error("Invalid operation: " + action);
	}
	return this;
};

function simplifyUpdate(op) {
	var f, doDelete = true;
	for (f in op.newValues) {
		if (op.newValues.hasOwnProperty(f)) {
			if (op.newValues[f] == op.oldValues[f]) {
				delete op.newValues[f];
				delete op.oldValues[f];
			} else {
				doDelete = false;
			}
		}
	}
	if (doDelete) {
		return null;
	} else {
		return op;
	}
}

function joinOps(op1, op2) {
	var f;
	if (!op1) {
		return op2;
	}
	if (!op2) {
		return op1;
	}
	if (op1.obj !== op2.obj) {
//		throw new Error("Mixin two database operations on diferent objects");
	}
	if (op1.action === "insert") {
		if (op2.action === "insert") {
			throw new Error("Two inserts of the same object in the same transaction");
		} else if (op2.action === "update") {
			for (f in op2.newValues) {
				if (op2.newValues.hasOwnProperty(f)) {
					op1.newValues[f] = op2.newValues[f];
				}
			}
			return op1;
		} else if (op2.action === "delete") {
			return null;
		}
	} else if (op1.action === "update") {
		if (op2.action === "insert") {
			throw new Error("Trying to insert an existing object");
		} else if (op2.action === "update") {
			for (f in op2.newValues) {
				if (op2.newValues.hasOwnProperty(f)) {
					if (op1.newValues[f] != op2.oldValues[f]) {
						op1.newValues[f] = op2.newValues[f];
						op1.oldValues[f] = op2.oldValues[f];
					} else {
						op1.newValues[f] = op2.newValues[f];
					}
				}
			}
			return simplifyUpdate(op1);
		} else if (op2.action === "delete") {
			for (f in op1.oldValues) {
				if (op1.oldValues.hasOwnProperty(f)) {
					op2.oldValues[f] = op1.oldValues[f];
				}
			}
			return op2;
		}
	} else if (op1.action === "delete") {
		if (op2.action === "insert") {
			op1.action = "update";
			op1.newValues = {};
			for (f in op1.oldValues) {
				if (op1.oldValues.hasOwnProperty(f)) {
					op1.newValues[f] = null;
				}
			}
			for (f in op2.newValues) {
				if (op2.newValues.hasOwnProperty(f)) {
					op1.newValues[f] = op2.newValues[f];
				}
			}
			return simplifyUpdate(op1);
		} else if (op2.action === "update") {
			throw new Error("Trying to update a deleted object");
		} else if (op2.action === "delete") {
			console.log("Deleting a deleted object " + op1.obj);
			return op1;
		}
	}
}



exports.Transaction = function (db) {
	this.ops = {};
	this.db = db;

	this.addOp = function (op) {
		var id;
		id = op.obj.$schema.name + "_" + op.obj.$keyStr;
		this.ops[id] = joinOps(this.ops[id], op);
	};

	this.addInsert = function (obj) {
		var op;
		if (!obj.$keyStr) {
			throw new Error("Object must have an id before insertion");
		}
		op = new DbOp("insert", obj);
		this.addOp(op);
	};

	this.addDelete = function (obj) {
		var op;
		op = new DbOp("delete", obj);
		this.addOp(op);
	};

	this.addUpdate = function (obj, field, oldvalue, newvalue) {
		var op;
		op = new DbOp("update", obj, field, oldvalue, newvalue);
		this.addOp(op);
	};

	this.execOps = function(cb) {
		var op, cobj, self, connection;

		self = this;
		async.eachSeries(Object.keys(self.ops), function(aopk, cb2) {
			var aop = self.ops[aopk];
			if (!aop) {
				cb2();
			} else if (aop.action === "insert") {
				var oldKey;
				if (aop.obj.$schema.fields[aop.obj.$schema.id[0]].autoincrement) {
					db.$destroyRelations(aop.obj);
					db.$callRemoveTriggers(aop.obj);
					oldKey = aop.obj.$key;
					db.$driver.insert(aop.obj.$schema.dbTableName, aop.newValues, function(err, result) {
						if (err) return cb2(err);
						mk.delete(aop.obj.$all,oldKey);
						aop.obj.$data[ aop.obj.$schema.fields[aop.obj.$schema.id[0]].dbFieldName] = result.insertId;
						mk.set(aop.obj.$all,aop.obj.$key, aop.obj);
						db.$constructRelations(aop.obj);
						db.$callAddTriggers(aop.obj);
						cb2();
					});
				} else {
					db.$driver.insert(aop.obj.$schema.dbTableName, aop.newValues, cb2);
				}
			} else if (aop.action === "update") {
				db.$driver.update(aop.obj.$schema.dbTableName, aop.newValues, aop.obj, cb2);
			} else if (aop.action === "delete") {
				db.$driver.delete(aop.obj.$schema.dbTableName, aop.obj, cb2);
			} else {
				cb2(new Error("invalid action: "+ aop.action));
			}
		}, cb);
	};

/*
	this.commit = function (cb) {
		var op, cobj, self, connection;

		self = this;

		db.$driver.startTransaction(function(err) {
			if (err) {
				return self.rollback(function(err2) {
					cb(err);
				});
			}
			self.execOps(function(err) {
				if (err) {
					return self.rollback(function(err2) {
						cb(err);
					});
				}
				db.$driver.commit(cb);
			});
		}, db.transactionLog);
	};
*/
	this.rollback = function (cb) {
		function rollbackOp(op) {
			var vals;
			var f, obj;
			if (op.action === "insert") {
				op.obj.remove();
			} else if (op.action === "update") {
				vals = db2js(op.obj.$schema, op.oldValues);
				op.obj.update(vals);
			} else if (op.action === "delete") {
				vals = db2js(op.obj.$schema, op.oldValues);
				obj = new op.obj.constructor(vals);
			}
		}

		var op, cpOps;

		cpOps = U.clone(this.ops);

		U.each(cpOps, function(op) {
			rollbackOp(op);
		});


		U.each(this.ops, function(op) {
			if (op) {
				console.log("Rollback faled: incosistency");
				throw new Error("Rollback faled: incosistency");
			}
		});

		this.db.$driver.rollback(cb);
	};
};

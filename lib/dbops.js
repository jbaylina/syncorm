/*jslint node: true */
"use strict";

var U = require("underscore");
var async = require("async");

function clone(obj) {
	if (obj === null || typeof (obj) !== 'object') {
		return obj;
	}

	var key, temp = {}; // changed

	for (key in obj) {
		if (obj.hasOwnProperty(key)) {
			temp[key] = obj[key];
		}
	}
	return temp;
}

function cloneNorm(obj) {
	if ((typeof (obj) !== 'object') || (!obj.$schema)) {
		throw new Error("Can not CloneNorm a non object");
	}

	var fieldName, temp = {};

	U.each(obj.$schema.fields, function(field, fieldName) {
		var S = field.$type.normalize(obj[fieldName]);
		temp[field.dbFieldName] = S;
	});

	return temp;
}

var DbOp = function (action, obj, fieldName, oldValue, newValue) {
	this.action = action;
	this.obj = obj;
	if (action === "insert") {
		this.oldValues = null;
		this.newValues = cloneNorm(obj);
	} else if (action === "delete") {
		this.oldValues = cloneNorm(obj);
		this.newValues = null;
	} else if (action === "update") {
		this.oldValues = {};
		this.newValues = {};

		var field = obj.$schema.fields[fieldName];

		oldValue = field.$type.normalize(oldValue);
		newValue = field.$type.normalize(newValue);

		if (oldValue === newValue) {
			return null;
		}
		this.oldValues[field.dbFieldName] = oldValue;
		this.newValues[field.dbFieldName] = newValue;
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
		id = op.obj.$schema.name + "_" + op.obj.$key;
		this.ops[id] = joinOps(this.ops[id], op);
	};

	this.addInsert = function (obj) {
		var op;
		if (!obj.$key) {
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
				db.$driver.insert(aop.obj.$schema.dbTableName, aop.newValues, cb2);
			} else if (aop.action === "update") {
				db.$driver.update(aop.obj.$schema.dbTableName, aop.newValues, aop.obj, cb2);
			} else if (aop.action === "delete") {
				db.$driver.delete(aop.obj.$schema.dbTableName, aop.obj, cb2);
			} else {
				cb2(new Error("invalid action: "+ aop.action));
			}
		}, cb);
	};

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
		});
	};

	this.rollback = function (cb) {
		function rollbackOp(op) {
			var f, obj;
			if (op.action === "insert") {
				op.obj.remove();
			} else if (op.action === "update") {
				for (f in op.oldValues) {
					if (op.oldValues.hasOwnProperty(f)) {
						op.obj[f] = op.oldValues[f];
					}
				}
			} else if (op.action === "delete") {
				obj = new op.obj.constructor(op.oldValues);
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

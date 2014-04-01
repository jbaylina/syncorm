/*jslint node: true */
"use strict";

var Q = require("q");

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

var DbOp = function (action, obj, field, oldValue, newValue) {
	this.action = action;
	this.obj = obj;
	if (action === "insert") {
		this.oldValues = null;
		this.newValues = clone(obj.$data);
	} else if (action === "delete") {
		this.oldValues = clone(obj.$data);
		this.newValues = null;
	} else if (action === "update") {
		this.oldValues = {};
		this.newValues = {};
		if (oldValue === newValue) {
			return null;
		}
		this.oldValues[field] = oldValue;
		this.newValues[field] = newValue;
	} else {
		throw new Error("Invalid operation: " + action);
	}
	return this;
};

function simplifyUpdate(op) {
	var f, doDelete = true;
	for (f in op.newValues) {
		if (op.newValues.hasOwnProperty(f)) {
			if (op.newValues[f] === op.oldValues[f]) {
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
					if (typeof op1.newValues[f] === "undefined") {
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
		id = op.obj.$schema.name + "_" + op.obj[op.obj.$schema.id];
		this.ops[id] = joinOps(this.ops[id], op);
	};

	this.addInsert = function (obj) {
		var op;
		if (!obj[obj.$schema.id]) {
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

	this.commit = function () {
		var q, defered, op, cobj, self, connection;

		function execOp(q, aop) {
			return q.then(function () {
				if (!aop) {
					return;
				}
				if (aop.action === "insert") {
					return db.$driver.insert(aop.obj.$schema.table, aop.newValues);
				} else if (aop.action === "update") {
					return db.$driver.update(aop.obj.$schema.table, aop.newValues, aop.obj.$schema.id, aop.obj[aop.obj.$schema.id]);
				} else if (aop.action === "delete") {
					return db.$driver.delete(aop.obj.$schema.table, aop.obj.$schema.id, aop.obj[aop.obj.$schema.id]);
				}
			});
		}

		self = this;

		defered = new Q.defer();
		q = db.$driver.startTransaction();
		for (op in this.ops) {
			if (this.ops.hasOwnProperty(op)) {
				q = execOp(q, this.ops[op]);
			}
		}
		q = q.then(function () {
			return db.$driver.commit();
		});
		q = q.then(function () {
			defered.resolve();
		});
		q = q.fail(function (err) {
			defered.reject(err);
		});
		q.done();
		return defered.promise;
	};

	this.rollback = function () {
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

		cpOps = {};
		for (op in this.ops) {
			if (this.ops.hasOwnProperty(op)) {
				cpOps[op] = clone(this.ops[op]);
			}
		}

		for (op in cpOps) {
			if (cpOps.hasOwnProperty(op)) {
				rollbackOp(cpOps[op]);
			}
		}

		for (op in this.ops) {
			if (this.ops.hasOwnProperty(op)) {
				if (this.ops[op]) {
					console.log("Rollback faled: incosistency");
					throw new Error("Rollback faled: incosistency");
				}
			}
		}

		return this.db.$driver.rollback();
	};
};
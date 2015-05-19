/*jslint node: true */
"use strict";

var mysql = require('mysql'),
	U = require("underscore");


exports.Driver = function(params, log) {
	var self= this;

	params.dateStrings= true;
	this.pool = mysql.createPool(params);
	this.connection = null;


	this.pool.on('connection', function (connection) {
		var sql = "SET  @dbops_user := '" + params.dbOpsUser + "'";
		connection.query(sql);
		log("verbose", sql);
	});

//	connection.connect();
	this.params = params;

	this.format = function(sql, values) {
		return mysql.format(sql, values, self.params.stringifyObjects, self.params.timezone);
	};

	this.getAll = function(table,fields,condition, opts, cb) {
		var sFields, sql, qq;

		if (typeof opts === "function") {
			cb = opts;
			opts = {};
		}

		if (typeof fields === undefined) {
			sFields="*";
		} else {
			sFields="";
			U.each(fields, function(f) {
				if (sFields !== "") {
					sFields += ",";
				}
				sFields += "T."+mysql.escapeId(f);
			});
		}
		if ((condition) && (condition.substring(0,6).toUpperCase() === "SELECT" )) {
			sql = condition;
		} else if ((condition) && (condition.substring(0,4).toUpperCase() === "FROM" )) {
			sql = "SELECT "+sFields+" "+condition;
		} else {
			sql = "SELECT "+sFields+" FROM "+mysql.escapeId(table)+" T ";
			if (condition) {
				sql += " WHERE "+condition;
			}
		}

		if (opts.forUpdate) {
			sql += " FOR UPDATE";
		}


//		sql = sql + " LIMIT 100";

		log("verbose",sql);

		if (self.connection) {
			self.connection.query(sql, cb);
		} else {
			this.pool.getConnection(function(err, c) {
				if (err) {
					log("error", sql + " -> " + err);
					return cb(err);
				}
				c.query(sql, function(err, rows) {
					c.release();
					if (err) {
						log("error", sql + " -> " + err);
						return cb(err);
					}
					if (err) return cb(err);
					return cb(null, rows);
				});
			});
		}

	};

	this.insert = function(table, values, cb) {
		var sql;

		sql = self.format("INSERT INTO ?? SET ?", [table, values]);

		if (!self.connection) {
			return cb(new Error("Insert not in a transaction"));
		}

		log("verbose",sql);
		self.connection.query(sql,  function(err, result) {
			if (err) {
				log("error", sql + " -> " + err);
				return cb(err);
			}
			cb(null, result);
		});


	};

	this.update = function(table, values, obj, cb) {
		var i;
		var sql;

		if (!self.connection) {
			return cb(new Error("Update not in a transaction"));
		}

		sql = self.format("UPDATE ?? SET ? WHERE ", [table, values]);

		for (i=0; i<obj.$schema.id.length; i++) {
			if (i>0) sql = sql + " AND ";
			sql = sql + mysql.escapeId(obj.$schema.fields[obj.$schema.id[i]].dbFieldName) + "=" + mysql.escape(obj[obj.$schema.id[i]]);
		}

		log("verbose",sql);
		self.connection.query(sql, function(err, result) {
			if (err) {
				log("error", sql + " -> " + err);
				return cb(err);
			}
			cb(null, result);
		});

	};

	this.delete = function(table, obj, cb) {
		var i;
		var sql;

		if (!self.connection) {
			return cb(new Error("Delete not in a transaction"));
		}

		sql = self.format("DELETE FROM ?? WHERE ", [table]);

		for (i=0; i<obj.$schema.id.length; i++) {
			if (i>0) sql = sql + " AND ";
			sql = sql + mysql.escapeId(obj.$schema.fields[obj.$schema.id[i]].dbFieldName) + "=" + mysql.escape(obj[obj.$schema.id[i]]);
		}


		log("verbose",sql);
		self.connection.query(sql, function(err) {
			if (err) {
				log("error", sql + " -> " + err);
				return cb(err);
			}
			cb();
		});
	};

	this.startTransaction = function(cb) {

		if (self.connection) {
			return cb(new Error("Already in a transaction"));
		}

		this.pool.getConnection(function(err, c) {
			if (err) return cb(err);

			self.connection=c;
			log("verbose","BEGIN");
			self.connection.query("BEGIN",function(err) {
				if (err) {
					log("error", "BEGIN" + " -> " + err);
					return cb(err);
				}
				cb();
			});
		});
	};


	this.commit = function(cb) {

		if (!self.connection) {
			return cb(new Error("Commit not in a transaction"));
		}

		log("verbose","COMMIT");
		self.connection.query("COMMIT", function(err) {
			if (err) {
				log("error", "COMMIT" + " -> " + err);
			}
			self.connection.release();
			self.connection = null;
			if (err) {
				self.rollback(function(err2) {
					cb(err);
				});
				return;
			}
			cb();
		});

	};


	this.rollback = function(cb) {
		if (!self.connection) {
			return cb();
		}

		log("verbose","ROLLBACK");

		self.connection.query("ROLLBACK", function(err) {
			if (err) {
				log("error", "ROLLBACK" + " -> " + err);
			}
			self.connection.release();
			self.connection = null;
			if (err) return cb(err);

			cb();
		});

	};

	this.deleteOldDbOps = function(lastId, cb) {
		var connection;
		var self = this;

		function getConnection(cb) {
			if (self.connection) {
				return cb(null, self.connection);
			} else {
				self.pool.getConnection(cb);
			}
		}
		var sql = 'DELETE FROM dbops WHERE id <= ?';

		log("verbose","DELETE old dbops");

		if (self.connection) {
			self.connection.query(sql, [lastId], function(err) {
				if (err) {
					log("error", sql + " -> " + err);
					return cb(err);
				}
				cb();
			});

		} else {
			self.pool.getConnection(function(err, connection) {
				if (err) {
					log("error", sql + "(getConnection)" + " -> " + err);
					return cb(err);
				}
				connection.query(sql, [lastId], function(err) {
					if(err) {
						log("error", sql + "(inNewConnection)" + " -> " + err);
						return cb(err);
					}
					connection.query('COMMIT', function(err) {
						if (err) {
							log("error", sql +  "(rollback)" + " -> " + err);
						}
						connection.release();
						if (err) {
							return cb(err);
						}
						return cb();
					});
				});
			});
		}


	};

	this.escape = mysql.escape;
	this.escapeId = mysql.escapeId;

};

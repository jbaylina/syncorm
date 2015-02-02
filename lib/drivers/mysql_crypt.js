var mysql = require('mysql'),
	Q = require("q"),
	U = require("underscore"),
	crypto = require("crypto");

var key= "Canviem";

function decrypt(table, id, c) {
	var cipher = crypto.createDecCpher("aes-256-cbc", table + id + key);
	var splain = cipher.update(c, 'base64', 'utf8');
	splain += cipher.final('utf8');

	return JSON.parse(splain);
}

function encrypt(table,id,o) {
	var defered = Q.defer();
	var b1, b2;

	var cipher = crypto.createCipher("aes-256-cbc", table + id + key);
	var splain = JSON.stringify(o);
	var bcrypted = cipher.update(splain, 'utf8', 'base64');
	bcrypted += cipher.final('base64');

	return bcrypted;
}


exports.Driver = function(params) {
	var self= this;
	this.pool = mysql.createPool(params);
	this.connection = null;

//	connection.connect();
	this.params = params;

	this.format = function(sql, values) {
		return mysql.format(sql, values, self.params.stringifyObjects, self.params.timezone);
	};

	this.getAll = function(table,fields,condition) {
		var defered = Q.defer();
		var sSields, sql, qq;

		sql = "SELECT obj FROM crypted_data WHERE class="+mysql.escapeId(table);

//		sql = sql + " LIMIT 100";

		self.pool.query(sql, function(err, crows) {
			if (err) {
				console.log(err);
				defered.reject(err);
				return;
			}
			var rows = [];
			U.each(crows, function(r) {
				rows.push(decrypt(table, r.id, r.obj));
			});
			defered.resolve(rows);
		});

		return defered.promise;
	};

	this.insert = function(table, obj) {
		var sql,defered = Q.defer();

		var setObj = {
			"id": obj.$key,
			"class": table,
			obj: encrypt(table, obj.$key, values)
		};
		sql = self.format("INSERT INTO crypted_data SET ?", [setObj]);

		if (!self.connection) {
			defered.reject("Insert not in a transaction");
			return defered.promise;
		}

		self.connection.query(sql,  function(err) {
			if (err) {
				defered.reject(err);
				return;
			}
			defered.resolve();
		});


		if (self.params.sqlLog) {
			console.log(sql);
		}

		return defered.promise;
	};

	this.update = function(table, values, obj) {
		var i;
		var sql, defered = Q.defer();

		if (!self.connection) {
			defered.reject("Insert not in a transaction");
			return defered.promise;
		}
		
		var setObj = {
			"id":  obj.$key,
			"class": table,
			obj: encrypt(table, obj.$key, values)
		};
		sql = self.format("UPDATE crypted_data SET ? WHERE class=? and id=?", [setObj, table, obj.$key]);


		self.connection.query(sql, function(err) {
			if (err) {
				defered.reject(err);
			}
			defered.resolve();
		});

		if (self.params.sqlLog) {
			console.log(sql);
		}

		return defered.promise;
	};

	this.delete = function(table, obj) {
		var i;
		var sql, defered = Q.defer();

		if (!self.connection) {
			defered.reject("Insert not in a transaction");
			return defered.promise;
		}

		sql = self.format("DELETE FROM crypted_data WHERE class=? AND id=? ", [table, obj.$key]);

		self.connection.query(sql, function(err) {
			if (err) {
				defered.reject(err);
			}
			defered.resolve();
		});
		if (self.params.sqlLog) {
			console.log(sql);
		}
		return defered.promise;
	};

	this.startTransaction = function() {
		var defered = Q.defer();

		if (self.connection) {
			defered.reject("Already in a transaction");
			return defered.promise;
		}

		this.pool.getConnection(function(err, c) {
			if (err) {
				console.log(err);
				defered.reject(err);
				return;
			}
			self.connection=c;

			self.connection.query("BEGIN", function(err) {
				if (err) {
					defered.reject();
					return;
				}
				defered.resolve();
			});
			if (self.params.sqlLog) {
				console.log("BEGIN");
			}
		});

		return defered.promise;
	};


	this.commit = function() {
		var defered = Q.defer();


		if (!self.connection) {
			defered.reject("Not in a transaction");
			return defered.promise;
		}

		self.connection.query("COMMIT", function(err) {
			if (err) {
				defered.reject(err);
				return;
			}
			self.connection.release();
			self.connection = null;
			defered.resolve();
		});
		if (self.params.sqlLog) {
			console.log("COMMIT");
		}
		return defered.promise;
	};


	this.rollback = function() {
		var defered = Q.defer();

		if (!self.connection) {
			defered.resolve();
			return defered.promise;
		}

		self.connection.query("ROLLBACK", function(err) {
			if (err) {
				defered.reject();
			}

			self.connection.release();
			self.connection = null;
			defered.resolve();
		});
		if (self.params.sqlLog) {
			console.log("ROLLBACK");
		}
		return defered.promise;
	};

};
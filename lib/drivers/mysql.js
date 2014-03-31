var mysql = require('mysql'),
	Q = require("q"),
	U = require("underscore");


exports.Driver = function(params) {
	var connection = mysql.createConnection(params);

	connection.connect();
	this.params = params;

	this.getAll = function(table,fields,condition) {
		var defered = Q.defer();
		var sSields, sql, qq;

		if (typeof fields === undefined) {
			sFields="*";
		} else {
			sFields="";
			U.each(fields, function(f) {
				if (sFields !== "") {
					sFields += ",";
				}
				sFields += mysql.escapeId(f);
			});
		}
		sql = "SELECT "+sFields+" FROM "+mysql.escapeId(table);
		if (condition) {
			sql += " WHERE "+condition;
		}

		qq = connection.query(sql, function(err, rows) {
			if (err) {
				defered.reject(err);
			}
			defered.resolve(rows);
		});

		if (this.params.sqlLog) {
			console.log(qq.sql);
		}

		return defered.promise;
	};

	this.insert = function(table, values) {
		var qq,defered = Q.defer();

		qq=connection.query("INSERT INTO ?? SET ?", [table, values], function(err) {
			if (err) {
				defered.reject(err);
			}
			defered.resolve();
		});

		if (this.params.sqlLog) {
			console.log(qq.sql);
		}

		return defered.promise;
	};

	this.update = function(table, values, indexname, indexvalue) {
		var qq, defered = Q.defer();
		
		qq = connection.query("UPDATE ?? SET ? WHERE ?? = ?", [table, values, indexname, indexvalue], function(err) {
			if (err) {
				defered.reject(err);
			}
			defered.resolve();
		});

		if (this.params.sqlLog) {
			console.log(qq.sql);
		}

		return defered.promise;
	};

	this.delete = function(table, indexname, indexvalue) {
		var qq, defered = Q.defer();

		qq = connection.query("DELETE FROM ?? WHERE ?? = ?", [table, indexname, indexvalue], function(err) {
			if (err) {
				defered.reject(err);
			}
			defered.resolve();
		});
		if (this.params.sqlLog) {
			console.log(qq.sql);
		}
		return defered.promise;
	};

	this.startTransaction = function() {
		var defered = Q.defer();

		connection.query("BEGIN", function(err) {
			if (err) {
				defered.reject();
			}
			defered.resolve();
		});
		if (this.params.sqlLog) {
			console.log("BEGIN");
		}

		return defered.promise;
	};


	this.commit = function() {
		var defered = Q.defer();

		connection.query("COMMIT", function(err) {
			if (err) {
				defered.reject();
			}
			defered.resolve();
		});
		if (this.params.sqlLog) {
			console.log("COMMIT");
		}
		return defered.promise;
	};


	this.rollback = function() {
		var defered = Q.defer();

		connection.query("ROLLBACK", function(err) {
			if (err) {
				defered.reject();
			}
			defered.resolve();
		});
		if (this.params.sqlLog) {
			console.log("ROLLBACK");
		}
		return defered.promise;
	};

};
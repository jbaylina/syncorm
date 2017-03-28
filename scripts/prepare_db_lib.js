/*jslint node: true */
"use strict";

var mysql = require('mysql'),
	async = require('async');

function prepareTable(db, t, cb, excluded) {
	console.log(t + ":Preparing " + (excluded ? ' - excluded!': ''));
	var index_fields;
	async.series([function(cb2) {
		if(excluded) return cb2();
		var q = "SHOW KEYS FROM `" + t + "` WHERE Key_name='PRIMARY' ";
		db.query(q, function(err, rows) {
			if (err) {
				cb2(err);
			}
			rows.sort(function(a,b) {
				return a.Seq_in_index - b.Seq_in_index;
			});
			index_fields = rows.map(function(row) {
				return row.Column_name;
			});
			if (index_fields.length === 0) {
				console.log("Table without primary key: "+ t);
				return cb();
			}
			cb2();
		});
	},function(cb2) {
		var q = "DROP TRIGGER IF EXISTS " + t+"_ai_dbops";
		db.query(q, cb2);
	},function(cb2) {
		if(excluded) return cb2();
		var q = "CREATE TRIGGER "+ t+"_ai_dbops AFTER INSERT ON "+ t + "\n"+
				" FOR EACH ROW \n"+
				" BEGIN \n"+
				"    INSERT INTO dbops SET `user` = @dbops_user, \n" +
				"                          `table`=  '" + t +"', \n" +
				"                          `op` = 'INSERT', \n" +
				"                          `datetime` = NOW(), \n" +
				"                          `key` = CONCAT(";
		var S="";
		index_fields.forEach(function(f) {
			if (S !== "") {
				S += ",'|',";
			}
			S += "new.`" + f + "`";
		});
		q += S + "); \n" +
				"END; \n";
		db.query(q, cb2);
	},function(cb2) {
		var q = "DROP TRIGGER IF EXISTS " + t+"_au_dbops";
		db.query(q, cb2);
	},function(cb2) {
		if(excluded) return cb2();
		var S;
		var q = "CREATE TRIGGER "+ t+"_au_dbops AFTER UPDATE ON "+ t + "\n"+
				" FOR EACH ROW \n"+
				" BEGIN \n"+
				"    DECLARE oldkey VARCHAR(512); \n" +
				"    DECLARE newkey VARCHAR(512); \n" +
				"    SET @oldkey := CONCAT(";
		S="";
		index_fields.forEach(function(f) {
			if (S !== "") {
				S += ",'|',";
			}
			S += "old.`" + f + "`";
		});
		q +=  S + "); \n"+
				"   SET @newkey := CONCAT(";
		S="";
		index_fields.forEach(function(f) {
			if (S !== "") {
				S += ",'|',";
			}
			S += "new.`" + f + "`";
		});
		q +=  S + "); \n"+
				"    IF @newkey <> @oldkey THEN \n" +
				"    	  INSERT INTO dbops SET `user` = @dbops_user, \n" +
				"                          `table` =  '" + t +"', \n" +
				"                          `op` = 'DELETE', \n" +
				"                          `datetime` = NOW(),\n" +
				"                          `key` = @oldkey; \n" +
				"         INSERT INTO dbops SET `user` = @dbops_user, \n" +
				"                               `table` =  '" + t +"', \n" +
				"                               `op` = 'INSERT', \n" +
				"                               `datetime` = NOW(),\n" +
				"                               `key` = @newkey; \n" +
				"    ELSE \n"+
				"    	   INSERT INTO dbops SET `user` = @dbops_user, \n" +
				"                          `table` =  '" + t +"', \n" +
				"                          `op` = 'UPDATE', \n" +
				"                          `datetime` = NOW(),\n" +
				"                          `key` = @oldkey; \n" +
				"    END IF; \n" +
				"END; \n";
		db.query(q, cb2);
	},function(cb2) {
		var q = "DROP TRIGGER IF EXISTS " + t+"_ad_dbops";
		db.query(q, cb2);
	},function(cb2) {
		if(excluded) return cb2();
		var q = "CREATE TRIGGER "+ t+"_ad_dbops AFTER DELETE ON "+ t + "\n"+
				" FOR EACH ROW \n"+
				" BEGIN \n"+
				"    INSERT INTO dbops SET `user` = @dbops_user, \n" +
				"                          `table` =  '" + t +"', \n" +
				"                          `op` = 'DELETE', \n" +
				"                          `datetime` = NOW(), \n" +
				"                          `key` = CONCAT(";
		var S="";
		index_fields.forEach(function(f) {
			if (S !== "") {
				S += ",'|',";
			}
			S += "old.`" + f + "`";
		});
		q += S + "); \n" +
				"END; \n";
		db.query(q, cb2);
	}], function(err) {
		cb(err);
	});
}


function prepareDB(db, cb, excluded) {
	var excluded = excluded ? excluded.split(',') : [];
	async.series([function(cb2) {
		var q = "DROP TABLE IF EXISTS `dbops`;";
		db.query(q, cb2);
	}, function(cb2) {
		db.query("show full tables where Table_Type = 'BASE TABLE';", function(err, rows) {
			if (err) {
				return cb2(err);
			}
			var tables=rows.map(function(r) {
				return r[Object.keys(r)[0]]; //returns 'someVal'
			});
			async.eachSeries(tables, function(t, cb3) {
				prepareTable(db,t,cb3,(excluded.indexOf(t) !== -1));
			}, function(err) {
				cb2(err);
			});
		});
	},function(cb2) {
		var q = "CREATE  TABLE `dbops` (" +
				" `id` INT NOT NULL AUTO_INCREMENT ," +
				" `user` VARCHAR(45) NULL ," +
				" `table` VARCHAR(45) NULL ," +
				" `op` VARCHAR(8) NULL ," +
				" `key` VARCHAR(256) NULL ," +
				" `datetime` DATETIME NULL ," +
				" PRIMARY KEY (`id`) );";
		db.query(q, cb2);
	}], function(err) {
		cb(err);
	});
}


module.exports= prepareDB;




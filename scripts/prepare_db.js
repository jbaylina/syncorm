/*jslint node: true */
"use strict";

var mysql = require('mysql'),
	async = require('async'),
	program = require('commander'),
	prompt = require('prompt'),
	prepareDB = require("./prepare_db_lib.js");

var self = {};
var db;

async.series([function(cb) {
	program
		.version('0.0.1')
		.option('-d, --db [db]', "Database to prepare (user@hostname/schema)" )
		.parse(process.argv);

	if (!program.db) {
		return cb(new Error("From Parameter not found"));
	}


	var arr;
	arr = /([^:@]*)(:([^@]+))?@([^:\/]*)(:(.*))?\/(.*)/.exec(program.db);

	if (!arr)  {
		return cb( new Error("Error parsing Database"));
	}

    if(program.excluded && typeof (program.excluded) !== "string") {
        return cb(new Error("Parameter of excluded tables needs them separated by commas."));
    }

	self.db = {
		host: arr[4],
		port: arr[6] ? arr[6]: 3306,
		user: arr[1],
		database: arr[7],
		password: arr[2] ? arr[3] : null
	};

	if (self.db.password !== null) {
		return cb();
	}

	prompt.message = "";
	prompt.delimiter = "";

	prompt.start();
	prompt.get({ properties: {
		pwddb: {
			hidden:true,
			description: arr[5]+ " password: "
		}

	}}, function(err, result) {
		if (err) {
			return cb(err);
		}
		self.db.password = result.pwddb;
		cb();
	});
},function(cb) {
	db= mysql.createConnection(self.db);
	db.connect(cb);
},function(cb) {
	prepareDB(db,cb, program.excluded);
}],function(err) {
	if (err) {
		console.log("Error: "+err);
		console.log(err.stack);
		program.outputHelp();
		process.exit(-1);

	} else {
		process.exit(0);
	}
});




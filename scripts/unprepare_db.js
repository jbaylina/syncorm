/*jslint node: true */
"use strict";

var mysql = require('mysql'),
    async = require('async'),
    program = require('commander'),
    prompt = require('prompt'),
    unprepareDB = require("./unprepare_db_lib.js");

var self = {};
var db;

async.series([function(cb) {
    program
        .version('0.0.1')
        .option('-d, --db [db]', "Database to unprepare (user@hostname/schema)" )
        .parse(process.argv);

    if (!program.db) {
        return cb(new Error("From Parameter not found"));
    }


    var arr;
    arr = /(.*)@([^:\/]*)(:(.*))?\/(.*)/.exec(program.db);

    if (!arr)  {
        return cb( new Error("Error parsing Database"));
    }

    self.db = {
        host: arr[2],
        port: arr[4] ? arr[4]: 3306,
        user: arr[1],
        database: arr[5]
    };

    prompt.message = "";
    prompt.delimiter = "";

    prompt.start();
    prompt.get({ properties: {
        pwddb: {
            hidden:true,
            description: program.from+ " password: "
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
    unprepareDB(db,cb);
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




/*jslint node: true */
"use strict";

var mysql = require('mysql'),
    async = require('async');

function unprepareTable(db, t, cb) {
    console.log(t + ": unreparing");
    var index_fields;
    async.series([function(cb2) {
        var q = "DROP TRIGGER IF EXISTS " + t+"_ai_dbops";
        db.query(q, cb2);

    },function(cb2) {
        var q = "DROP TRIGGER IF EXISTS " + t+"_au_dbops";
        db.query(q, cb2);
    },function(cb2) {
        var q = "DROP TRIGGER IF EXISTS " + t+"_ad_dbops";
        db.query(q, cb2);
    }], function(err) {
        cb(err);
    });
}


function unprepareDB(db, cb) {
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
                unprepareTable(db,t,cb3);
            }, function(err) {
                cb2(err);
            });
        });
    }], function(err) {
        cb(err);
    });
}


module.exports= unprepareDB;




/*jslint node: true */
/*global describe, it, before, beforeEach, after, afterEach */
"use strict";

var assert = require("assert"); // node.js core module
var syncorm = require("../lib/syncorm.js");
var async = require("async");
var mysql = require('mysql');
var _ = require('underscore');

var connectionParams = {
            "driver": "mysql",
            "sqlLog": true,
            "host": "127.0.0.1",
            "port": 3306,
            "user": "root",
            "password": "",
            "timezone": "utc",
            "database": "syncorm_test",
            "synchronize": "false"
        };

function createTestDatabase(done) {
    console.log("Start creating a test database");
    this.timeout(10000);
    var connection = mysql.createConnection({
        host: "127.0.0.1",
        user: "root"
    });
    async.series([function() {
        connection.connect();
    }, function() {
        connection.query('DROP DATABASE IF EXISTS `syncorm_test`');
    }, function() {
        connection.query('CREATE SCHEMA `syncorm_test` DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci');
    }, function() {
        connection.query('USE syncorm_test');
    }, function() {
        connection.query(
            'CREATE  TABLE `syncorm_test`.`examples1` (' +
              '`id` INT NOT NULL ,' +
              '`string8` VARCHAR(8) NULL ,' +
              '`text` TEXT NULL ,' +
              '`date` DATE NULL ,' +
              '`datetime` DATETIME NULL ,' +
              '`double` DOUBLE NULL ,' +
              '`decimal112` DECIMAL(11,2) NULL ,' +
              '`boolean` TINYINT NULL ,' +
              'PRIMARY KEY (`id`) )');
    }, function() {
        connection.query(
            " INSERT INTO `syncorm_test`.`examples1` " +
            "        (`id`,`string8` ,`text`  ,`date`      ,`datetime`               ,`double`, `decimal112`  ,`boolean`)" +
            " VALUES ('1' ,'a string','a text','2015-03-09','2015-04-09 13:14:15.123','3.1416', '123456789.01','1'      )");
    }], done);

}

describe('Sync orm test', function() {
    var db = null;
    before(createTestDatabase);
    describe('Define the databese',function() {
        it("Should create the database", function() {
            db = new syncorm.Database(connectionParams);
            db.define({
                name: "Example1",
                table: "examples1",
                id: "id",
                fields: {
                    id: "integer",
                    string8: {
                        type: "string",
                        size: 8
                    },
                    text: "string",
                    date: "date",
                    datetime: "datetime",
                    double: "float",
                    decimal112: "float",
                    boolean: "boolean"
                }
            });
            assert(typeof db.Example1 === "function");
        });
        it ("Should load the database", function(done) {
            db.on('init', function() {
                done();
            });
            db.loadAll();
        });
        it("should have one object", function() {
            assert(_.size(db.examples1) === 1);
        });
        it("id should be 1", function() {
            assert(db.examples1[1].id === 1);
        });
        it("string8 should be 'a string'", function() {
            assert(db.examples1[1].string8 === 'a string');
        });
        it("text should be a test", function() {
            assert(db.examples1[1].test === 'a text');
        });
        it("date should be a specific date", function() {
            assert(db.examples1[1].date.toIsoString() === "2015-03-09T00:00:00.000Z");
        });
        it("date should be a specific datetime", function() {
            assert(db.examples1[1].datetime.toIsoString() === "2015-04-09T13:14:15.123Z");
        });
        it("double should be 3.1416", function() {
            assert(db.examples1[1].double === 3.1416);
        });
        it("decimal should be init value", function() {
            assert(db.examples1[1].boolean === true);
        });
    });
});

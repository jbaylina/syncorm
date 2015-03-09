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

var connection;

function createTestDatabase(done) {
    console.log("Start creating a test database");
    /* jshint ignore:start */
    this.timeout(10000);
    /* jshint ignore:end */
    connection = mysql.createConnection({
        host: "127.0.0.1",
        timezone: "utc",
        user: "root"
    });
    async.series([function(cb) {
        connection.connect(cb);
    }, function(cb) {
        connection.query('DROP DATABASE IF EXISTS `syncorm_test`', cb);
    }, function(cb) {
        connection.query('CREATE SCHEMA `syncorm_test` DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci', cb);
    }, function(cb) {
        connection.query('USE syncorm_test', cb);
    }, function(cb) {
        connection.query(
            'CREATE  TABLE `syncorm_test`.`examples1` (' +
              '`id` INT NOT NULL ,' +
              '`int` INT NULL ,' +
              '`string8` VARCHAR(8) NULL ,' +
              '`text` TEXT NULL ,' +
              '`date` DATE NULL ,' +
              '`datetime` DATETIME NULL ,' +
              '`double` DOUBLE NULL ,' +
              '`decimal112` DECIMAL(11,2) NULL ,' +
              '`boolean` TINYINT NULL ,' +
              'PRIMARY KEY (`id`) )', cb);
    }, function(cb) {
        connection.query(
            " INSERT INTO `syncorm_test`.`examples1` " +
            "        (`id`,`int`, `string8` ,`text`  ,`date`      ,`datetime`               ,`double`, `decimal112`  ,`boolean`)" +
            " VALUES ('1' ,-123     , 'a string','a text','2015-03-09','2015-04-09 13:14:15','3.1416', '123456789.01','1'      )", cb);
    }], done);
}

function assertSQL(sql, expectedResult, done) {
    connection.query(sql, function(err, result) {
        assert.ifError(err);
        assert.deepEqual(result, expectedResult);
        done();
    });
}

describe('Sync orm test', function() {
    var db = null;
    before(createTestDatabase);
    describe('Define and load the databese',function() {
        it("Should create the database", function() {
            db = new syncorm.Database(connectionParams);
            db.define({
                name: "Example1",
                table: "examples1",
                id: "id",
                fields: {
                    id: "integer",
                    int: "integer",
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
                it("key should be loaded", function() {
                    assert.equal(db.examples1[1].id, 1);
                });
                it("should have one object", function() {
                    assert.equal(_.size(db.examples1), 1);
                });
                done();
            });
            db.loadAll();
        });
    });
    describe('Testing read values',function() {
        it("integer read", function() {
            assert.equal(db.examples1[1].int, -123);
        });
        it("string read", function() {
            assert.equal(db.examples1[1].string8,'a string');
        });
        it("string read in a text field", function() {
            assert.equal(db.examples1[1].text, 'a text');
        });
        it("date read", function() {
            assert.equal(db.examples1[1].date.toISOString(), "2015-03-09T00:00:00.000Z");
        });
        it("datetime read", function() {
            assert.equal(db.examples1[1].datetime.toISOString(), "2015-04-09T13:14:15.000Z");
        });
        it("float read in a double field", function() {
            assert.equal(db.examples1[1].double, 3.1416);
        });
        it("float read in a decimal field", function() {
            assert.equal(db.examples1[1].boolean, true);
        });
    });
    describe('Testing write values',function() {
        it("update integer", function(done) {
            db.doTransaction(function() {
                db.examples1[1].int = 321;
            }, function(err) {
                assert.ifError(err);
                assert.equal(db.examples1[1].int, 321);
                assertSQL("SELECT `int` from examples1", [{int: 321}], done);
            });
        });
        it("update string", function(done) {
            db.doTransaction(function() {
                db.examples1[1].string8 = "12345678";
            }, function(err) {
                assert.ifError(err);
                assert.equal(db.examples1[1].string8, "12345678");
                assertSQL("SELECT `string8` from examples1", [{string8: "12345678"}], done);
            });
        });
        it("update string to null", function(done) {
            db.doTransaction(function() {
                db.examples1[1].string8 = null;
            }, function(err) {
                assert.ifError(err);
                assert.equal(db.examples1[1].string8, null);
                assertSQL("SELECT `string8` from examples1", [{string8: null}], done);
            });
        });
        it("update string to null", function(done) {
            db.doTransaction(function() {
                db.examples1[1].string8 = null;
            }, function(err) {
                assert.ifError(err);
                assert.equal(db.examples1[1].string8, null);
                assertSQL("SELECT `string8` from examples1", [{string8: null}], done);
            });
        });
        it("should throw a exception if editing outside a transaction", function() {
            assert.throws(function() {
                db.examples1[1].string8 = "hello";
            });
            assert.equal(db.examples1[1].string8, null);
        });
        it("should rolback if exception is thrown", function(done) {
            db.doTransaction(function() {
                db.examples1[1].string8 = "wolrd";
                throw new Error("A error");
            }, function(err) {
                assert.equal(err.message, "A error");
                assert.equal(db.examples1[1].string8, null);
                assertSQL("SELECT `string8` from examples1", [{string8: null}], done);
            });
        });
        it("should update integer", function(done) {
            db.doTransaction(function() {
                db.examples1[1].int = 4222;
            }, function(err) {
                assert.ifError(err);
                assert.equal(db.examples1[1].int, 4222);
                assertSQL("SELECT `int` from examples1", [{int: 4222}], done);
            });
        });
        it("should update integer with string", function(done) {
            db.doTransaction(function() {
                db.examples1[1].int = "-323";
            }, function(err) {
                assert.ifError(err);
                assert.equal(db.examples1[1].int, -323);
                assertSQL("SELECT `int` from examples1", [{int: -323}], done);
            });
        });
        it("should update date", function(done) {
            db.doTransaction(function() {
                db.examples1[1].date = new Date("2015-12-29 UTC");
            }, function(err) {
                assert.ifError(err);
                assert.equal(db.examples1[1].date.toISOString(), "2015-12-29T00:00:00.000Z");
                assertSQL("SELECT `date` from examples1", [{date: new Date("2015-12-29 UTC")}], done);
            });
        });
        it("should update date with String", function(done) {
            db.doTransaction(function() {
                db.examples1[1].date = "2016-02-29";
            }, function(err) {
                assert.ifError(err);
                assert.equal(db.examples1[1].date.toISOString(), "2016-02-29T00:00:00.000Z");
                assertSQL("SELECT `date` from examples1", [{date: new Date("2016-02-29 UTC")}], done);
            });
        });
    });
});

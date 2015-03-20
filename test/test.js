/*jslint node: true */
/*global describe, it, before, beforeEach, after, afterEach */
"use strict";

var assert = require("assert"); // node.js core module
var syncorm = require("../lib/syncorm.js");
var async = require("async");
var mysql = require('mysql');
var _ = require('underscore');
var prepareDB = require("../scripts/prepare_db_lib.js");
var IdxBtree  = require("syncorm-idxbtree");


var connectionParams = {
            "driver": "mysql",
            "sqlLog": true,
            "host": "127.0.0.1",
            "port": 3306,
            "user": "root",
            "password": "",
            "timezone": "utc",
            "database": "syncorm_test",
            "synchronize": false
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
            'CREATE  TABLE `syncorm_test`.`teams` (' +
              '`idTeam` INT NOT NULL ,' +
              '`name` VARCHAR(32) NULL ,' +
              'PRIMARY KEY (`idTeam`) )', cb);
    }, function(cb) {
        connection.query(
            'CREATE  TABLE `syncorm_test`.`players` (' +
              '`idPlayer` INT NOT NULL ,' +
              '`idTeam` INT NULL ,' +
              '`name` VARCHAR(32) NULL ,' +
              '`email` VARCHAR(64) NULL ,' +
              'PRIMARY KEY (`idPlayer`) )', cb);
    }, function(cb) {
        connection.query(
            'CREATE  TABLE `syncorm_test`.`dbids` (' +
              '`id` VARCHAR(16) NOT NULL ,' +
              '`last` INT NOT NULL ,' +
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

function defineDatabase(db) {
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
    db.define({
        name: "Team",
        table: "teams",
        id: "idTeam",
        fields: {
            idTeam: {
                type: "integer",
                def: function() {
                    return db.newId("teams");
                }
            },
            name: "string"
        }
    });
    db.define({
        name: "Player",
        table: "players",
        id: "idPlayer",
        fields: {
            idPlayer: {
                type: "integer",
                def: function() {
                    return db.newId("players");
                }
            },
            idTeam: "integer",
            name: "string"
        },
        relations: {
            team: {
                type: "Team",
                link: "idTeam",
                reverse: "players"
            }
        },
        indexes: {
            playerByEmail: new IdxBtree({key: "email"})
        }
    });
    db.define({
        name: "Dbid",
        table: "dbids",
        id: "id",
        fields: {
            id: {
                type: "string",
            },
            last: {
                type: "integer",
            }
        },
    });
    db.newId = function(dbid) {
        if (this.dbids[dbid]) {
            this.dbids[dbid].last += 1;
            return this.dbids[dbid].last;
        } else {
            var o = new this.Dbid({id: dbid, last: 1});
            return 1;
        }
    };
}

describe('Sync orm test', function() {
    var db = null;
    var db2 = null;
    before(createTestDatabase);
    describe('Define and load the databese',function() {
        it("Should create the database", function() {
            db = new syncorm.Database(connectionParams);
            assert.equal(typeof db, "object");
        });
        it("Should define database", function() {
            defineDatabase(db);
            assert(typeof db.Example1 === "function");
        });
        it("Should load the database", function(done) {
            this.timeout(10000);
            db.on('init', function() {
                assert.equal(db.examples1[1].id, 1);
                assert.equal(_.size(db.examples1), 1);
                done();
            });
            db.loadAll();
        });
//    });
//    describe('Testing read values',function() {
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
    describe('Relations',function() {
        it("should create a team with two players", function(done) {
            var team, player1, player2;
            db.doTransaction(function() {
                team = new db.Team({name: "barça"});
                player1 = new db.Player({idTeam: team.idTeam, name: "Jordi"});
                player2 = new db.Player();
                player2.idTeam = team.idTeam;
                player2.name = "Joan";
                assert.equal(player1.team, team, "Before commit");
                assert.equal(player2.team, team, "Before commit");
                assert.equal(team.players[player1.idPlayer], player1, "Before commit");
                assert.equal(team.players[player2.idPlayer], player2, "Before commit");
            }, function(err) {
                assert.ifError(err);
                assert.equal(player1.team, team, "After commit");
                assert.equal(player2.team, team, "After commit");
                assert.equal(team.players[player1.idPlayer], player1, "After commit");
                assert.equal(team.players[player2.idPlayer], player2, "After commit");
                async.series([
                    function(cb) {
                        assertSQL("SELECT * from teams", [
                            {
                                idTeam: 1,
                                name: "barça"
                            }
                        ], cb);
                    },function(cb) {
                        assertSQL("SELECT * from players", [
                            {
                                idPlayer: 1,
                                idTeam: 1,
                                name: "Jordi",
                                email: null
                            },
                            {
                                idPlayer: 2,
                                idTeam: 1,
                                name: "Joan",
                                email: null
                            }
                        ], cb);
                    }
                ], done);
            });
        });
        it("should remove references to the team if i remove a team rollback", function(done) {
            db.doTransaction(function() {
                assert.equal(db.players[1].team, db.teams[1]);
                assert.equal(db.players[2].team, db.teams[1]);
                db.teams[1].remove();
                assert.equal(db.players[1].team, null);
                assert.equal(db.players[2].team, null);
                throw new Error("Exception to force rollback");
            }, function(err) {
                assert.equal(db.players[1].team, db.teams[1]);
                assert.equal(db.players[2].team, db.teams[1]);
                done();
            });
        });
        it("should remove references to the team if i remove a team commit", function(done) {
            db.doTransaction(function() {
                assert.equal(db.players[1].team, db.teams[1]);
                assert.equal(db.players[2].team, db.teams[1]);
                db.teams[1].remove();
                assert.equal(db.players[1].team, null);
                assert.equal(db.players[2].team, null);
            }, function(err) {
                assert.ifError(err);
                assert.equal(db.players[1].team, null);
                assert.equal(db.players[2].team, null);
                done();
            });
        });
        it("restore the references when readded", function(done) {
            db.doTransaction(function() {
                var team = new db.Team({idTeam: 1, name: "barça"});
                assert.equal(db.players[1].team, team);
                assert.equal(db.players[2].team, team);
            }, function(err) {
                assert.ifError(err);
                assert.equal(db.players[1].team, db.teams[1]);
                assert.equal(db.players[2].team, db.teams[1]);
                assert.equal(db.teams[1].players[1], db.players[1]);
                assert.equal(db.teams[1].players[2], db.players[2]);
                done();
            });
        });
    });
    describe('Indexes',function() {
        it("index should update when inserted", function(done) {
            var idPlayer;
            db.doTransaction(function() {
                var player = new db.Player({name: "Jordi", email: "jordi@test.com"});
                idPlayer = player.idPlayer;
                var indexedPlayer = db.playerByEmail.lowerBound("jordi@test.com").data();
                assert.equal(player, indexedPlayer);
            }, function(err) {
                assert.ifError(err);
                var indexedPlayer2 = db.playerByEmail.lowerBound("jordi@test.com").data();
                assert.equal(db.players[idPlayer], indexedPlayer2);
                done();
            });
        });
        it("index should update index when deleted", function(done) {
            var idPlayer,prevPlayerB, curPlayerB, nextPlayerB;
            var prevPlayerA, curPlayerT, nextPlayerA;
            var prevPlayerT, nextPlayerT;
            db.doTransaction(function() {
                var itB = db.playerByEmail.lowerBound("jordi@test.com");
                prevPlayerB = itB.prev();
                curPlayerB = itB.next();
                nextPlayerB = itB.next();
                idPlayer = curPlayerB.idPlayer;
                curPlayerB.remove();
                var itA = db.playerByEmail.lowerBound("jordi@test.com");
                prevPlayerA = itA.data();
                nextPlayerA = itA.next();
                assert.equal(prevPlayerB, prevPlayerA);
                assert.equal(nextPlayerB, nextPlayerA);
                throw new Error("Force Roll back");
            }, function(err) {
                assert(db.players[idPlayer], null);
                var itT = db.playerByEmail.lowerBound("jordi@test.com");
                prevPlayerT = itT.prev();
                curPlayerT = itT.next();
                nextPlayerT = itT.next();
                assert.equal(prevPlayerB, prevPlayerT);
                assert.equal(db.players[idPlayer], curPlayerT);
                assert.equal(nextPlayerB, nextPlayerT);
                done();
            });
        });
    });
    describe('Syncronized',function() {
        it("prepare db for syncronization", function(done) {
            this.timeout(10000);
            prepareDB(connection,function(err) {
                assert.ifError(err);
                done();
            });
        });
        it("Redefine the database with sync", function(done) {
            this.timeout(10000);
            connectionParams.synchronize = true;
            db = new syncorm.Database(connectionParams);
            defineDatabase(db);
            db.loadAll(function(err) {
                assert.ifError(err);
                assert.equal(db.teams[1].name, "barça");
                done();
            });
        });
        it("Detect a new insert", function(done) {
            connection.query(
                " INSERT INTO `syncorm_test`.`teams` " +
                "        (`idTeam`,`name`)" +
                " VALUES ('2'     ,'R. Madrid')", function(err) {
                assert.ifError(err);
                db.refreshDatabase(function(err) {
                    assert.ifError(err);
                    assert.equal(db.teams[2].name, "R. Madrid");
                    done();
                });
            });
        });
        it("Detect an update (inside transaction)", function(done) {
            connection.query(
                " UPDATE `syncorm_test`.`teams` " +
                "   SET name = 'Real Madrid'" +
                "  WHERE `idTeam` = 2", function(err) {
                assert.ifError(err);
                db.doTransaction(function() {
                    assert.equal(db.teams[2].name, "Real Madrid");
                }, function(err) {
                    assert.ifError(err);
                    done();
                });
            });
        });
    });


});

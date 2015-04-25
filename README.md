# INTRODUCTION

[![Build Status](https://travis-ci.org/jbaylina/syncorm.svg?branch=master)](https://travis-ci.org/jbaylina/syncorm)

The main idea of this orm is to load the full database in memory at the begining of the execution.

Every record in the database is mapped to a javascript object. And you have a dictionary for each table where the key is the primary key and the value is the object representing the record.

The objects can be linked in a one to many relation.

So you can access all the data directly with javascript objects. It is very useful to use Underscore or Async libraries to traverse the tables and the linked records.

In the same way, you can also write to the database in a short transaction. You just edit the objects and the library will take care of writing every thing to the database in a transactional maner.


# NSTALL

    npm install syncorm

# TUTORIAL - Geting started

## Create an example database

Imagine an example database with two tables: persons and measures. The idea is to collect people's heigth at different moments of his live in order to construct the growth curves. Each person has many measures taked at diferent moment of his live. The definition of the tables could be:

	CREATE TABLE `measures` (
	  `idmeasure` int(11) NOT NULL,
	  `timestamp` datetime DEFAULT NULL,
	  `idperson` int(11) DEFAULT NULL,
	  `height` float DEFAULT NULL,
	  `parameters` text,
	  PRIMARY KEY (`idmeasure`)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8;

	CREATE TABLE `persons` (
	  `idperson` int(11) NOT NULL,
	  `firstname` varchar(45) DEFAULT NULL,
	  `lastname` varchar(45) DEFAULT NULL,
	  `birthdate` date DEFAULT NULL,
	  PRIMARY KEY (`idperson`)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8;

We can use MYSQL autoincrement feature, but I prefer to use an auxiliary "sequences" so I can control wich number is given. Here is the definition of the sequences talble:

	CREATE TABLE `sequences` (
	  `name` varchar(256) CHARACTER SET latin1 NOT NULL,
	  `last` bigint(20) DEFAULT NULL,
	  PRIMARY KEY (`name`)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8;

And for this example we will add some data to this database:

	INSERT INTO `persons` (`idperson`, `firstname`, `lastname`, `birthdate`) VALUES
	(1, 'Jordi', 'Baylina', '1973-04-03');

	INSERT INTO `measures` (`idmeasure`, `timestamp`, `idperson`, `height`, `parameters`) VALUES
	(1, '1973-04-03 16:38:52', 1, 0.5, NULL),
	(2, '1974-04-03 18:35:00', 1, 0.8, NULL),
	(3, '1975-04-03 12:08:00', 1, 1.1, NULL),
	(4, '2014-04-03 12:56:00', 1, 1.8, NULL);

	INSERT INTO `sequences` (`name`, `last`) VALUES
	('idmeasure', 4),
	('idperson', 1);




## Table definition

The first thing that we need to do, is define the tables:

    /*jslint node: true */
    "use strict";

    var Database = require('syncorm').Database;
    var _=require('underscore');

    var db = new Database({
        driver: "mysql",
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '',
        database: 'syncorm_tutorial',
        log: true
    });

    db.personsByLastName = {};

    db.define({
        name: "Person",
        table: "persons",
        id: "idperson",
        fields: {
            idperson: {
                type: "integer",
                def: function () {
                    return db.sequences.idperson.inc();
                }
            },
            firstname: "string",
            lastname: "string",
            birthdate: "date"
        },
        calculatedFields: {
            age: function() {
                var today = new Date();
                var birthDate = new Date(this.birthdate);
                var age = today.getFullYear() - birthDate.getFullYear();
                var m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate()))
                {
                    age--;
                }
                return age;
            }
        },
        triggers: [{
            add: function(obj) {
                db.personsByLastName[obj.lastname] = obj;
            },
            remove: function(obj) {
                delete db.personsByLastName[obj.lastname];
            }
        }]
    });

    db.define({
        name: "Measure",
        table: "measures",
        id: "idmeasure",
        fields: {
            idmeasure: {
                type: "integer",
                def: function () {
                    return db.sequences.idmeasure.inc();
                }
            },
            idperson: "integer",
            timestamp: "datetime",
            height: "float",
            parameters: "json"
        },
        relations: {
            person: {
                type: "Person",
                link: ["idperson"],
                reverse: "measures",
                reverseVisibility: ["PUBLIC"]
            }
        }
    });

    db.define({
        name: "Sequence",
        table: "sequences",
        id: "name",
        fields: {
            name: "string",
            last: "integer"
        },
        methods: {
            inc: function () {
                this.last += 1;
                return this.last;
            }
        }
    });


    db.on("init", function() {
        console.log("Database loaded");
    });

    db.loadAll();

## Reading data.


Let's start wit a simple example. Imagine that you just want to console out the full name for person with idperson=1.

    console.log(db.persons[1].firstname + " " + db.persons[1].lastname + " - Age: " + db.persons[1].age);

Imagine that you now want to print all the measures of the person with id person 1.

    _.each(db.persons[1].measures, function(measure) {
        console.log(measure.timestamp.toUTCString() + "\t" + measure.height.toFixed(2));
    });

Converting to a regular javascript object

    console.log(JSON.stringify(db.persons[1].toJSON()));


## Writing transactions.

Lets now see how we would add a person and the first measure to the database:


    db.doTransaction(function() {
        var person, measure;
        person = new db.Person({
            firstname: "John",
            lastname: "Smith"
        });
        measure = new db.Measure({
            idperson: person.idperson,
            height: 1.80,
            timestamp: new Date()
        });
    }, function(err) {
        if (err) {
            console.log("An error ocurred during the transaction: " + err.toString());
        } else {
            console.log("A new persona and measure are saved to the database");
        }
    });


We forgot to add the John's birthdate, so we can do another transaction to add it:

	db.doTransaction(function() {
		var person= _.findWhere(db.persons, {
					firstname: "John",
					lastname: "Smith"
				});

		if (!person) {
			throw new Error("John Smith not found");
		}

		person.birthdate = new Date("1973-04-03");

	}, function(err) {
		if (err) {
			console.log("An error ocurred during the transaction: " + err.toString());
		} else {
			console.log("A new persona and measure are saved to the database");
		}
	});


Lets now delete all the Johns measures in the same transaction.

    db.doTransaction(function() {
        var person= _.findWhere(db.persons, {
                    firstname: "John",
                    lastname: "Smith"
                });

        if (!person) {
            throw new Error("John Smith not found");
        }

        _.each(person.measures, function(measure) {
            measure.remove();
        });

        person.remove();

    }, function(err) {
        if (err) {
            console.log("An error ocurred during the transaction: " + err.toString());
        } else {
            console.log("A new persona and measure where deleted to the database");
        }
    });


## Calculated fields

    db.define({
        name: "Person",
        table: "persons",
        id: "idPerson",
        fields: {
            idPerson: "integer",
            name: "string",
            birthDate: "integer"
        },
        calcFields: {
            age: function () {
                var today = new Date();
                var age = today.getFullYear() - this.birthDate.getFullYear();
                var m = today.getMonth() - this.birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < this.birthDate.getDate()))
                {
                    age--;
                }
                return age;
            }
        }
    });

## Methods

    db.define({
        name: "Sequence",
        table: "sequences",
        id: "name",
        fields: {
            name: "string",
            last: "integer"
        },
        methods: {
            inc: function () {
                this.last += 1;
                return this.last;
            }
        }
    });

As you can see, the method inc can be caled for each record.

## Convert to JSON

Echa record can be converted to a regular javascript object whith the function
toJSON

    res.json(person.toJSON());

Each field/calculatedFired/relation can define a parameter "visibility" with an array of selectors (Each selector is a simple string). 

The first paramter to toJSON function is a selector. Only fields with this selector visibility will be inserted in the function.

The default selector if not specified is "PUBLIC".
The default selector for fields and calculated fiels ar "PUBLIC".
The default selector for relations is [].
The relation has a paameter called "reverseVisibility" that specifies the selectors that expand the reverse objects. The default is []

## Triggers

    db.define({
        name: "User",
        table: "users",
        id: "idUser",
        fields: {
            idUser: "string",
            password: "string",
            email: "string"
        },
        triggers: [{
            add: function(obj) {
                console.log(JSON.stringify(obj.toJSON()) + " added");
            },
            remove: function(obj) {
                console.log(JSON.stringify(obj.toJSON()) + " removed");
            }
        }]
    });

When updated, an add and a remove is called.

This is usefull to maintain a parallel data structure like an index.


## Multikey

    db.define({
        name: "Object",
        table: "objects",
        id: ["id1", "id2"]
        fields: {
            id1: "integer",
            id2: "string",
            afield: "string"
        },
    });

You can access this way:

    db.objects[1]["a"]

Or better:

    var mk = require('syncorm').mk;

    mk.get(db.objects, [1,"a"]);

### mk sublibrary

With this mk you can also call all keys of an object

    mk.each(db.objects, 2, function(obj, k) {

    });

## Refresh from database

## Logging





INTRODUCTION
============

The main idea of this orm is to load the full database in memory at the begining of the execution.

Every record in the database is mapped to a javascript object. And you have a dictionary for each table where the key is the primary key and the value is the object representing the record.

The objects can be linked in a one to many relation.

So you can access all the data directly with javascript objects. It is very useful to use Underscore or Async libraries to traverse the tables and the linked records.

In the same way, you can also write to the database in a short transaction. You just edit the objects and the library will take care of writing every thing to the database in a transactional maner.

The process to write to the databese is the next:

1.- Start a transaction.
2.- Write directly to the objects that you want to modify.
3.- Commit the transaction.

The start transaction is an asyncronous method that just guaranty that no one else is in a transaction.
When you are in a transaction, you can Create new objects, modify the objects or delete objects in the javascript way.

When you are finish, you just call the commit() method. This asyncronous method, starts a database transaction (START TRANSACTION), does all the INSERTs/UPDATEs/DELETEs to the database necessary to apply all the changes made in in the momory objects to the database, and finally runs a database COMMIT. After that, a promise is resolved (or a callback is called).

In the middle of a transaction, you can also call a rollback(), and the Objects returns the data to the original state when you started the transaction.


TUTORIAL
---------

Imagine a database called peoplesheight with two tables: persons and measures. The idea is to collect people's heigth at different moments of his live in order to construct the growth curves. Each person has many measures taked at diferent moment of his live. The definition of the tables could be:

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

Let's start wit a simple example. Imagine that you just want to console out the full name for person with idperson=56.

The program would be:

	var db = require('./peopleheights').db;
		U = require('underscore');

	var idperson = 1;

	db.on('init', function() {
		console.log(db.persons[idperson].firstname + " " + db.persons[idperson].lastname);
	});


The module peoplesheigth is where you specify how the database is mapped in memory. We will see later how to write this module.

Imagine that you now want to print all the measures of the person with id person 56.

	var db = require('./peopleheights').db,
		U = require('underscore');

	var idperson = 1;

	db.on('init', function() {
		console.log(db.persons[idperson].firstname + " " + db.persons[idperson].lastname);
		U.each(db.persons[idperson].measures, function(measure) {
			console.log(measure.timestamp.toUTCString() + "\t" + measure.height.toFixed(2));
		});
	});


Lets now see how we would add a person and the first measure to the database:

	var db = require('./peopleheights').db,
		U = require('underscore');

	db.on('init', function() {
		return db.startTransaction()
			.then(function() {
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
				return db.commit();
			})
			.then(function() {
				console.log("The person and the measure has been added in a single transaction");
			})
			.fail(function(err) {
				console.log(err.stack);
				console.log("Some thing went wrong so we rollback");
				db.rollback();
			});
	});

We forgot to add the John's birthdate. Imagine also that we want to delete all the Johns measures in the same transaction.

	var db = require('./peopleheights').db,
		U = require('underscore');

	db.on('init', function() {
		return db.startTransaction()
			.then(function() {
				var person;
				person= U.findWhere(db.persons, {
					firstname: "John",
					lastname: "Smith"
				});

				if (!person) {
					throw new Error("John Smith not found");
				}

				person.birthdate = new Date("1973-04-03");

				U.each(person.measures, function(measure) {
					measure.remove();
				});

				return db.commit();
			})
			.then(function() {
				console.log("Updates and deletes has been made");
			})
			.fail(function(err) {
				console.log(err.stack);
				console.log("Some thing went wrong so we rollback");
				db.rollback();
			});
	});


Defining the database
---------------------

Here is the file to define the database. It's self explanatory:

	var syncorm = require("syncorm");

	var db = new syncorm.Database({
			driver: "mysql",
			sqlLog: true,
	        host: '127.0.0.1',
	        port: 8889,
	        user: 'root',
	        password: 'root',
	        database: 'peopleheights'
	    });

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
			firstname: {
				type: "string",
				size: 255
			},
			lastname: {
				type: "string",
				size: 255
			},
			birthdate: "date"
		},
		calculatedFields: {
			age: function() {
				var today = new Date();
				var birthDate = new Date(dateString);
				var age = today.getFullYear() - birthDate.getFullYear();
				var m = today.getMonth() - birthDate.getMonth();
				if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate()))
				{
					age--;
				}
				return age;
			}
		},
		indexes: {
			lname2person: function(p) {
				return p.lname;
			}
		}
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
			idperson: {
				type: "Person",
				name: "person",
				reverse: "measures"
			},
			timestamp: "datetime",
			height: "float",
			parameters: "json"
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

	exports.db = db;

	db.loadAll();








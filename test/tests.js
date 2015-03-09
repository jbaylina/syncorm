
var db = require("../examples/peopleheights.js").db,
	U = require("underscore");

exports.setUp = function (callback) {
	if (!db.$initialized) {
		db.on("init", function() {
			callback();
		});
	} else {
		callback();
	}
};

exports.connect= function(test) {
	test.strictEqual(db.persons[1].firstname, "Jordi", "Person 1's name is not 'Jordi'");
	test.done();
};


exports.insert= function(test) {
	var data={};

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
				data.idperson=person.idperson;
				data.idmeasure=measure.idmeasure;
				return db.commit();
			})
			.then(function() {
				test.ok(db.persons[data.idperson].lastname === "Smith","Last name should be Smith");
				test.ok(db.persons[data.idperson].measures[data.idmeasure].height === 1.80, "The measure must be 1.80");
				test.done();
			})
			.fail(function(err) {
				console.log(err.stack);
				console.log("Some thing went wrong so we rollback");
				db.rollback();
			});
};

exports.rollback= function(test) {
	var data={};

		return db.startTransaction()
			.then(function() {
				var person, measure;
				data.countmeasures=U.size(db.measures);
				person = new db.Person({
					firstname: "John",
					lastname: "Smith"
				});
				measure = new db.Measure({
					idperson: person.idperson,
					height: 1.80,
					timestamp: new Date()
				});
				data.idperson=person.idperson;
				test.ok(data.countmeasures + 1 === U.size(db.measures), "Measures must be incremented by one");

				return db.rollback();
			})
			.then(function() {
				test.ok(data.countmeasures === U.size(db.measures), "Measures must be restored to it's original value");
				test.ok(db.persons[data.idperson] === undefined,"Last name should be Smith");
				test.done();
			})
			.fail(function(err) {
				console.log(err.stack);
				console.log("Some thing went wrong so we rollback");
				db.rollback();
			});
};

exports.updateanddelete= function(test) {
	var data={};

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
				data.idperson=person.idperson;
				data.idmeasure=measure.idmeasure;
				return db.commit();
			})
			.then(function() {
				test.ok(db.persons[data.idperson].lastname === "Smith","Last name should be Smith");
				test.ok(db.persons[data.idperson].measures[data.idmeasure].height === 1.80, "The measure must be 1.80");
				return db.startTransaction();
			})
			.then(function() {
				measure = db.measures[data.idmeasure];
				measure.person = null;
				return db.commit();
			})
			.then(function() {
				test.strictEqual(db.measures[data.idmeasure].idpersona, undefined, "Measure must not have persona");
				return db.startTransaction();
			})
			.then(function() {
				measure = db.measures[data.idmeasure];
				measure.remove();
				return db.commit();
			})
			.then(function() {
				test.ok(db.measures[data.idmeasure] === undefined, "Measure must be deleted");
				test.done();
			})
			.fail(function(err) {
				console.log(err.stack);
				console.log("Some thing went wrong so we rollback");
				db.rollback();
			});
};



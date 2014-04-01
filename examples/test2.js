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
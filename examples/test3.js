var db = require('./peopleheights').db,
	U = require('lodash');

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

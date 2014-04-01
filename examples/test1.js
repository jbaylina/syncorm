var db = require('./peopleheights').db,
	U = require('underscore');

var idperson = 1;

db.on('init', function() {
	console.log(db.persons[idperson].firstname + " " + db.persons[idperson].lastname);
	U.each(db.persons[idperson].measures, function(measure) {
		console.log(measure.timestamp.toUTCString() + "\t" + measure.height.toFixed(2));
	});
});

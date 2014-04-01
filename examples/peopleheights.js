var syncorm = require("../lib/syncorm");

var db = new syncorm.Database({
		driver: "mysql",
		sqlLog: false,
        host: '127.0.0.1',
        port: 8889,
        user: 'root',
        password: 'root',
        database: 'peopleheights',
        timezone: 'UTC'
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
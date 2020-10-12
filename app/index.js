const express = require('express');
const mysql = require('mysql2/promise');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const app = express();
const config = require('config');
const port = config.get('port');

var mysqlConfig = JSON.parse(JSON.stringify(config.get('mysql')));
poolWriter  = mysql.createPool(mysqlConfig.writer);

//You need to set a session variable to enable writes if you are connecting from a non-master region
poolWriter.on('connection', function(connection) {
	if (mysqlConfig.write_forwarding){
		//Let's set it whenever we get a new connection from the pool
		connection.query("set @@aurora_replica_read_consistency = 'session';", function (error, results, fields) {
		if (error) throw error;
		console.log('Got new MySQL Pool Writer connection and set Aurora write_forwarding');
	});
	} else {
		connection.query('SELECT 1 + 1 AS solution', function (error, results, fields) {
			if (error) throw error;
			console.log('Got new MySQL Pool Writer');
		});
	}
});


app.get('/', async(req, res) => {
	try {
		const [rows] = await poolWriter.execute('SELECT id, ctime FROM users LIMIT 5');
		res.json({success: true, data: rows});
	}
	catch (e){
		console.error(e);
		res.json({success: false});
	}
});

app.post('/write', async (req, res) => {
	try {
		const [result] = await poolWriter.query('INSERT into users SET ?', {
			ctime: parseInt(+new Date()/1000)
		});
		res.json({success: true, id: result.insertId});
	}
	catch (e){
		console.error(e);
		res.json({success: false});
	}
});

app.listen(port, () => {
	console.log(`App listening at http://localhost:${port} with env ${process.env.NODE_ENV}`);
})

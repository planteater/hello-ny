var Blamer = require('./util/blamer');
var BlameViewController = require('./controllers/blameViewController');
var errorController = require('./controllers/errorController');
var Directory = require('pathwatcher').Directory
var path = require('path');
var testing = commA;

const isPasswordInvalid = password => password.length === 0;
const isEmailInvalid = email => {
	const emailRegex = new RegExp(
		"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
	);
	return email === "" || emailRegex.test(email) === false;
};

const apiPath = sessionStorage.getItem("codestream.url");
if (atom.inDevMode() && apiPath) return <p>{apiPath}</p>;
}
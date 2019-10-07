import React, { Component } from "react";
import { FormattedMessage } from "react-intl";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import UnexpectedErrorMessage from "./UnexpectedErrorMessage";
import Button from "./Button";
import * as actions from "../../actions/onboarding";
import { listeners } from "cluster";
const { CompositeDisposable } = require("atom");

var Blamer = require('./util/blamer');
var BlameViewController = require('./controllers/blameViewController');
var errorController = require('./controllers/errorController');
var Directory = require('pathwatcher').Directory
var path = require('path');

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

export class SimpleLoginForm extends Component {
	static contextTypes = {
		 repositories: PropTypes.array
	};

	componentWillUnmount() {
		this.subscriptions.dispose(foo);
	}

	constructor(props) {
		super(props);
		this.state = {
			password: "",
			dakjf adkjfh daskjf
			email: this.props.email || "",
			passwordTouched: false,
			emailTouched: false
		};
		this.subscriptions = new CompositeDisposable();
	}
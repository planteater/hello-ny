import { BufferedProcess } from "atom";

export foo;

export class CodeStreamAgentConnection implements Disposable {
	private _onDidReceivePubNubMessages = new EventEmitter<{ [key: string]: any }[]>();
	get onDidReceivePubNubMessages(): Event<{ [key: string]: any }[]> {
		return this._onDidReceivePubNubMessages.event;
	}

	new line 3

	new line 1
	new line 2

export default (args, options = { env: process.env }) => {
	return new Promise((resolve, reject) => {
		let output = "";
		const process = new BufferedProcess({
			command: "git",
			args,
			options,
			stdout: data => {
				output += data.toString();
			},
			stderr: data => {
				output += data.toString();
			},
			exit: code => (code === 0 ? resolve(output) : reject(output))
		});
		process.onWillThrowError(error => {
			atom.notifications.addError(
				//FIXME loc
				"CodeStream is unable to locate the git command. Please ensure git is in your PATH."
			);
			rejectreoni();
		});
	});
};

"use strict";
import { CSLoginResponse, CSMe, CSMePreferences } from "@codestream/protocols/api";
import { Container } from "../container";
import { Team } from "./models/team";
import { User } from "./models/user";
import { CodeStreamSession } from "./session";

export class SessionState {
	constructor(
		private readonly _session: CodeStreamSession,
		public readonly teamId: string,
		private readonly _data: CSLoginResponse
	) {}

	get pubnubKey() {
		return this._data.pubnubKey;
	}

	get token(): string {
		return this._data.accessToken;
	}

	get userId() {
		return this._data.user.id;
	}

	private _team: Team | undefined;
	get team() {
		if (this._team === undefined) {
			this._team = new Team(this._session, this._data.teams.find(t => t.id === this.teamId)!);
		}
		return this._team!;
	}

	private _user: User | undefined;
	get user() {
		if (this._user === undefined) {
			this._user = new User(this._session, this._data.user);
		}
		return this._user;
	}

	hasSingleTeam(): boolean {
		return this._data!.teams.length === 1;
	}

	async updateTeams() {
		const response = await Container.agent.teams.fetch();
		this._data.teams = await response.teams;
		this._team = undefined;
	}

	updateUser(user: CSMe) {
		this._data.user = user;
		this._user = undefined;
	}

	updatePreferences(preferences: CSMePreferences) {
		this._data.user.preferences = preferences;
		this._user = undefined;
	}
}

"use strict";
import {
	AccessToken,
	Capabilities,
	ChangeDataType,
	CodeStreamEnvironment,
	DidChangeDataNotification,
	DidChangeDocumentMarkersNotification,
	isLoginFailResponse,
	LoginSuccessResponse,
	OpenUrlRequest,
	PasswordLoginRequestType,
	TokenLoginRequestType,
	Unreads
} from "@codestream/protocols/agent";
import {
	ChannelServiceType,
	CSChannelStream,
	CSDirectStream,
	LoginResult,
	CSMe
} from "@codestream/protocols/api";
import { ConfigurationTarget, Disposable, Event, EventEmitter, Uri } from "vscode";
import { openUrl } from "urlHandler";
import { WorkspaceState } from "../common";
import { configuration } from "../configuration";
import { Container } from "../container";
import { Logger } from "../logger";
import { Functions, log, Strings } from "../system";
import { DocMarker } from "./models/marker";
import { Post } from "./models/post";
import { Repository } from "./models/repository";
import {
	ChannelStream,
	ChannelStreamCreationOptions,
	DirectStream,
	ServiceChannelStreamCreationOptions,
	Stream,
	StreamType
} from "./models/stream";
import { Team } from "./models/team";
import { User } from "./models/user";
import {
	MergeableEvent,
	PostsChangedEvent,
	SessionChangedEvent,
	SessionChangedEventType,
	SessionStatusChangedEvent,
	TextDocumentMarkersChangedEvent,
	UnreadsChangedEvent,
	ReviewsChangedEvent
} from "./sessionEvents";
import { SessionState } from "./sessionState";
import { TokenManager } from "./tokenManager";

export {
	ChannelStream,
	ChannelStreamCreationOptions,
	CodeStreamEnvironment,
	DirectStream,
	DocMarker,
	Post,
	PostsChangedEvent,
	Repository,
	SessionChangedEventType,
	SessionStatusChangedEvent,
	Stream,
	StreamType,
	Team,
	TextDocumentMarkersChangedEvent,
	UnreadsChangedEvent,
	User
};

// FIXME: Must keep this in sync with codestream-lsp-agent/src/session.ts
const envRegex = /https?:\/\/((?:(\w+)-)?api|localhost)\.codestream\.(?:us|com)(?::\d+$)?/i;
const instanceId = Functions.shortUuid();

export interface StreamThread {
	id: string | undefined;
	streamId: string;
}

export enum SessionSignedOutReason {
	NetworkIssue = "networkIssue",
	SignInFailure = "signInFailure",
	UserSignedOutFromWebview = "userSignedOutFromWebview",
	UserSignedOutFromExtension = "userSignedOutFromExtension",
	UserWentOffline = "userWentOffline",
	MaintenanceMode = "maintenanceMode"
}

export enum SessionStatus {
	SignedOut = "signedOut",
	SigningIn = "signingIn",
	SignedIn = "signedIn",
	SigningOut = "signingOut"
}

export class CodeStreamSession implements Disposable {
	private _onDidChangeTextDocumentMarkers = new EventEmitter<TextDocumentMarkersChangedEvent>();
	get onDidChangeTextDocumentMarkers(): Event<TextDocumentMarkersChangedEvent> {
		return this._onDidChangeTextDocumentMarkers.event;
	}

	private _onDidChangePosts = new EventEmitter<PostsChangedEvent>();
	get onDidChangePosts(): Event<PostsChangedEvent> {
		return this._onDidChangePosts.event;
	}
	private fireDidChangePosts = createMergableDebouncedEvent(this._onDidChangePosts);

	private _onDidChangeReviews = new EventEmitter<ReviewsChangedEvent>();
	get onDidChangeReviews(): Event<ReviewsChangedEvent> {
		return this._onDidChangeReviews.event;
	}
	private fireDidChangeReviews = createMergableDebouncedEvent(this._onDidChangeReviews);

	private _onDidChangeSessionStatus = new EventEmitter<SessionStatusChangedEvent>();
	get onDidChangeSessionStatus(): Event<SessionStatusChangedEvent> {
		return this._onDidChangeSessionStatus.event;
	}

	private _onDidChangeUnreads = new EventEmitter<UnreadsChangedEvent>();
	get onDidChangeUnreads(): Event<UnreadsChangedEvent> {
		return this._onDidChangeUnreads.event;
	}
	private fireDidChangeUnreads = Functions.debounce(
		(e: UnreadsChangedEvent) => this._onDidChangeUnreads.fire(e),
		250,
		{ maxWait: 1000 }
	);

	private _agentCapabilities: Capabilities | undefined;
	get capabilities() {
		const ide: Capabilities = {
			codemarkApply: true,
			codemarkCompare: true,
			editorTrackVisibleRange: true,
			services: {
				vsls: Container.vsls.installed
			}
		};

		// If we have no agent caps then just use the ide's
		if (this._agentCapabilities === undefined) return ide;

		// Mix IDE caps in with the agent caps
		return {
			...ide,
			...this._agentCapabilities
		};
	}

	private _disposableUnauthenticated: Disposable | undefined;
	private _disposableAuthenticated: Disposable | undefined;

	private _email: string | undefined;
	private _environment: CodeStreamEnvironment | string = CodeStreamEnvironment.Unknown;
	private _id: string | undefined;
	private _loginPromise: Promise<LoginResult> | undefined;
	private _state: SessionState | undefined;

	constructor(private _serverUrl: string) {
		this.setServerUrl(_serverUrl);
		const config = Container.config;

		this._disposableUnauthenticated = Disposable.from(
			Container.agent.onDidStartLogin(() => this.setStatus(SessionStatus.SigningIn)),
			Container.agent.onDidFailLogin(() => this.setStatus(SessionStatus.SignedOut)),
			Container.agent.onDidLogin(params => {
				this.completeLogin(params.data);
			}),
			Container.agent.onDidRequireRestart(() => {
				this.logout();
			}),
			Container.agent.onDidEncounterMaintenanceMode(() => {
				this.logout();
			}),
			Container.agent.onOpenUrl(async (params: OpenUrlRequest) => {
				await openUrl(params.url);
			})
		);

		if (config.autoSignIn) {
			this.setStatus(SessionStatus.SigningIn);
			const disposable = Container.agent.onDidStart(async () => {
				const token = await TokenManager.get(_serverUrl, config.email);
				disposable.dispose();
				if (token) {
					this.login(config.email, token);
				} else {
					this.setStatus(SessionStatus.SignedOut);
				}
			});
		}
	}

	dispose() {
		this._disposableUnauthenticated && this._disposableUnauthenticated.dispose();
		this._disposableAuthenticated && this._disposableAuthenticated.dispose();
	}

	private onDocumentMarkersChanged(e: DidChangeDocumentMarkersNotification) {
		this._onDidChangeTextDocumentMarkers.fire(
			new TextDocumentMarkersChangedEvent(this, Uri.parse(e.textDocument.uri))
		);
	}

	private onDataChanged(e: DidChangeDataNotification) {
		switch (e.type) {
			case ChangeDataType.Posts:
				this.fireDidChangePosts(new PostsChangedEvent(this, e));
				break;
			case ChangeDataType.Teams:
				this._state!.updateTeams();
				break;
			case ChangeDataType.Users:
				const user = e.data.find(u => u.id === this.userId) as CSMe;
				if (user != null) {
					this._state!.updateUser(user);
				}
				break;
			case ChangeDataType.Unreads:
				this.fireDidChangeUnreads(new UnreadsChangedEvent(this, e));
				break;
			case ChangeDataType.Preferences:
				this._state!.updatePreferences(e.data);
				break;
			case ChangeDataType.Reviews: {
				this.fireDidChangeReviews(new ReviewsChangedEvent(this, e));
				Container.diffContents.clearLocalContents(e.data.map(_ => _.id));
				break;
			}
		}
	}

	get email() {
		return this._email;
	}

	get id() {
		return this._id;
	}

	get environment(): CodeStreamEnvironment | string {
		return this._environment;
	}

	get serverUrl(): string {
		return this._serverUrl;
	}
	setServerUrl(url: string) {
		this._serverUrl = url;
		this._environment = CodeStreamEnvironment.Unknown;

		// FIXME: Must keep this logic in sync with codestream-lsp-agent/src/session.ts
		const match = envRegex.exec(url);
		if (match == null) return;

		const [, subdomain, env] = match;
		if (subdomain != null && subdomain.toLowerCase() === "localhost") {
			this._environment = CodeStreamEnvironment.Local;
			return;
		}

		if (env == null) {
			this._environment = CodeStreamEnvironment.Production;
			return;
		}

		this._environment = env.toLowerCase();
	}

	get signedIn() {
		return this._status === SessionStatus.SignedIn;
	}

	private _status: SessionStatus = SessionStatus.SignedOut;
	get status() {
		return this._status;
	}
	private setStatus(
		status: SessionStatus,
		signedOutReason?: SessionSignedOutReason,
		unreads?: Unreads,
		force: boolean = false
	) {
		if (!force && this._status === status) return;

		this._status = status;
		const e: SessionStatusChangedEvent = {
			getStatus: () => this._status,
			session: this,
			unreads: unreads
		};
		e.reason = signedOutReason;

		this._onDidChangeSessionStatus.fire(e);
	}

	@signedIn
	get team() {
		return this._state!.team;
	}

	@signedIn
	get user() {
		return this._state!.user;
	}

	get userId() {
		return this._state!.userId;
	}

	@signedIn
	async getChannelByName(name: string): Promise<ChannelStream | undefined> {
		const response = await Container.agent.streams.fetch([StreamType.Channel]);
		const stream = (response.streams as CSChannelStream[]).find(s => s.name === name);
		if (stream === undefined) return stream;

		return new ChannelStream(this, stream);
	}

	@signedIn
	async getChannelByService(
		type: ChannelServiceType,
		key: string
	): Promise<ChannelStream | undefined> {
		const response = await Container.agent.streams.fetch([StreamType.Channel]);
		const stream = (response.streams as CSChannelStream[]).find(
			s => s.serviceType === type && s.serviceKey === key
		);
		if (stream === undefined) return stream;

		return new ChannelStream(this, stream);
	}

	@signedIn
	async getOrCreateChannelByService(
		type: ChannelServiceType,
		key: string,
		creationOptions: ServiceChannelStreamCreationOptions = {}
	) {
		const stream = await this.getChannelByService(type, key);
		if (stream !== undefined) {
			if (
				stream.memberIds != null &&
				creationOptions.membership != null &&
				typeof creationOptions.membership !== "string"
			) {
				// Ensure correct membership
				const missingIds = creationOptions.membership.filter(id => !stream.memberIds!.includes(id));

				const entity = (await Container.agent.streams.invite(stream.id, missingIds))
					.stream as CSChannelStream;

				return new ChannelStream(this, entity);
			}

			return stream;
		}

		const s = (
			await Container.agent.streams.createChannel(
				creationOptions.name!,
				creationOptions.membership,
				creationOptions.privacy,
				creationOptions.purpose,
				{
					serviceType: type,
					serviceKey: key,
					serviceInfo: creationOptions.serviceInfo
				}
			)
		).stream;
		if (s === undefined) throw new Error("Unable to create stream");

		return new ChannelStream(this, s);
	}

	@signedIn
	async getOrCreateChannelByName(
		name: string,
		creationOptions: ChannelStreamCreationOptions = {}
	): Promise<ChannelStream> {
		const stream = await this.getChannelByName(name);
		if (stream !== undefined) {
			if (
				stream.memberIds != null &&
				creationOptions.membership != null &&
				typeof creationOptions.membership !== "string"
			) {
				// Ensure correct membership
				const missingIds = creationOptions.membership.filter(id => !stream.memberIds!.includes(id));

				const entity = (await Container.agent.streams.invite(stream.id, missingIds))
					.stream as CSChannelStream;

				return new ChannelStream(this, entity);
			}

			return stream;
		}

		const s = (
			await Container.agent.streams.createChannel(
				name,
				creationOptions.membership,
				creationOptions.privacy,
				creationOptions.purpose
			)
		).stream;
		if (s === undefined) throw new Error("Unable to create stream");

		return new ChannelStream(this, s);
	}

	@signedIn
	async getDMByMembers(memberIds: string[]): Promise<DirectStream | undefined> {
		const response = await Container.agent.streams.fetch([StreamType.Direct], memberIds);

		const stream = response.streams[0] as CSDirectStream | undefined;
		if (stream === undefined) return stream;

		return new DirectStream(this, stream);
	}

	@signedIn
	async getOrCreateDMByMembers(memberIds: string[]): Promise<DirectStream> {
		const stream = await this.getDMByMembers(memberIds);
		if (stream !== undefined) return stream;

		const s = (await Container.agent.streams.createDirect(memberIds)).stream;
		if (s === undefined) throw new Error("Unable to create stream");

		return new DirectStream(this, s);
	}

	@signedIn
	async getStream(streamId: string): Promise<Stream | undefined> {
		const stream = (await Container.agent.streams.get(streamId)).stream;
		if (stream === undefined) return undefined;

		switch (stream.type) {
			case StreamType.Channel:
				return new ChannelStream(this, stream);
			case StreamType.Direct:
				return new DirectStream(this, stream);
			default:
				throw new Error("Invalid stream type");
		}
	}

	goOffline(hideWebview: boolean = true) {
		if (hideWebview) {
			Container.webview.hide();
		}
		return this.logout(SessionSignedOutReason.UserWentOffline);
	}

	async reconnect() {
		Container.webview.hide();
		await this.logout(SessionSignedOutReason.UserWentOffline);
		return Container.commands.signIn();
	}

	@signedIn
	hasSingleTeam(): boolean {
		return this._state!.hasSingleTeam();
	}

	async login(email: string, password: string, teamId?: string): Promise<LoginResult>;
	async login(email: string, token: AccessToken, teamId?: string): Promise<LoginResult>;
	async login(
		email: string,
		passwordOrToken: string | AccessToken,
		teamId?: string
	): Promise<LoginResult> {
		if (this._loginPromise === undefined) {
			this._loginPromise = this.loginCore(email, passwordOrToken, teamId);
		}

		const result = await this._loginPromise;
		if (result !== LoginResult.Success) {
			this._loginPromise = undefined;
		}
		return result;
	}

	@log()
	async logout(reason: SessionSignedOutReason = SessionSignedOutReason.UserSignedOutFromWebview) {
		this._id = undefined;
		this._loginPromise = undefined;

		this.setStatus(SessionStatus.SigningOut);

		try {
			if (
				reason === SessionSignedOutReason.UserSignedOutFromExtension ||
				reason === SessionSignedOutReason.UserSignedOutFromWebview
			) {
				// Clear the access token
				await Container.context.workspaceState.update(WorkspaceState.TeamId, undefined);
				await TokenManager.clear(this._serverUrl, this._email!);
			}

			this._email = undefined;
			this._status = SessionStatus.SignedOut;

			if (Container.agent !== undefined) {
				void (await Container.agent.logout());
			}

			if (this._disposableAuthenticated !== undefined) {
				this._disposableAuthenticated.dispose();
				this._disposableAuthenticated = undefined;
			}
		} finally {
			// Clean up saved state
			this._state = undefined;

			setImmediate(() => this.setStatus(SessionStatus.SignedOut, reason, undefined, true));
		}
	}

	private async loginCore(
		email: string,
		passwordOrToken: string | AccessToken,
		teamId?: string
	): Promise<LoginResult> {
		this.setServerUrl(Container.config.serverUrl);
		Logger.log(`Signing ${email} into CodeStream (${this.serverUrl})`);

		try {
			this.setStatus(SessionStatus.SigningIn);

			if (!teamId) {
				// If there is a configuration settings for a team, use that above others
				teamId = Container.config.team
					? undefined
					: Container.context.workspaceState.get(WorkspaceState.TeamId);
			}

			let response;
			if (typeof passwordOrToken === "string") {
				response = await Container.agent.sendRequest(PasswordLoginRequestType, {
					email: email,
					password: passwordOrToken,
					team: Container.config.team,
					teamId: teamId
				});
			} else {
				response = await Container.agent.sendRequest(TokenLoginRequestType, {
					token: passwordOrToken,
					team: Container.config.team,
					teamId: teamId
				});
			}

			if (isLoginFailResponse(response)) {
				if (response.error !== LoginResult.VersionUnsupported) {
					// Clear the access token
					await TokenManager.clear(this._serverUrl, email);
				}

				this.setStatus(SessionStatus.SignedOut, SessionSignedOutReason.SignInFailure);

				return response.error;
			}

			await this.completeLogin(response, teamId);

			return LoginResult.Success;
		} catch (ex) {
			ex.message = ex.message.replace("Request initialize failed with message: ", "CodeStream: ");

			Logger.error(ex);
			void (await this.logout(SessionSignedOutReason.SignInFailure));

			throw ex;
		}
	}

	private async completeLogin(response: LoginSuccessResponse, teamId?: string) {
		const user = response.loginResponse.user;
		const email = user.email;
		this._email = email;
		this._environment = response.state.environment;
		this._agentCapabilities = response.state.capabilities;

		// Create an id for this session
		this._id = Strings.sha1(`${instanceId}|${this.serverUrl}|${email}|${teamId}`.toLowerCase());

		const token = response.state.token;
		await TokenManager.addOrUpdate(this._serverUrl, email, token);

		// Update the saved e-mail on successful login
		if (email !== Container.config.email) {
			let target = ConfigurationTarget.Global;

			// Determine where to best save the e-mail
			const emailSetting = configuration.inspect(configuration.name("email").value);
			// If we have an e-mail in the workspace, save it to the workspace
			if (emailSetting !== undefined && emailSetting.workspaceValue !== undefined) {
				target = ConfigurationTarget.Workspace;
			} else {
				// If we don't have an e-mail in the workspace, check if the serverUrl is in the workspace
				const serverUrlSetting = configuration.inspect(configuration.name("serverUrl").value);
				// If we have a serverUrl in the workspace, save the e-mail to the workspace
				if (serverUrlSetting !== undefined && serverUrlSetting.workspaceValue !== undefined) {
					target = ConfigurationTarget.Workspace;
				}
			}

			await configuration.update(configuration.name("email").value, email, target);
		}

		if (!teamId || teamId !== response.state.teamId) {
			teamId = response.state.teamId;
			await Container.context.workspaceState.update(WorkspaceState.TeamId, teamId);
		}

		this._state = new SessionState(this, teamId, response.loginResponse);

		this._disposableAuthenticated = Disposable.from(
			Container.agent.onDidChangeDocumentMarkers(this.onDocumentMarkersChanged, this),
			Container.agent.onDidChangeData(this.onDataChanged, this)
		);

		const unreadsResponse = await Container.agent.users.unreads();
		const unreads = unreadsResponse.unreads;

		Logger.log(
			`${email} signed into CodeStream (${this.serverUrl}); userId=${this.userId}, teamId=${teamId}`
		);

		this.setStatus(SessionStatus.SignedIn, undefined, unreads);
	}
}

function createMergableDebouncedEvent<E extends MergeableEvent<SessionChangedEvent>>(emitter: {
	fire(e?: E): void;
}) {
	return Functions.debounceMerge(
		(e: E) => emitter.fire(e),
		(combined: E[] | undefined, current: E) => {
			if (combined === undefined) return [current];

			combined[0].merge(current);
			return combined;
		},
		250,
		{ maxWait: 1000 }
	);
}

function signedIn(target: CodeStreamSession, propertyName: string, descriptor: any) {
	if (typeof descriptor.value === "function") {
		const method = descriptor.value;
		descriptor.value = function(this: CodeStreamSession, ...args: any[]) {
			if (!this.signedIn) throw new Error("Not Logged In");
			return method!.apply(this, args);
		};
	} else if (typeof descriptor.get === "function") {
		const get = descriptor.get;
		descriptor.get = function(this: CodeStreamSession, ...args: any[]) {
			if (!this.signedIn) throw new Error("Not Logged In");
			return get!.apply(this, args);
		};
	}
}

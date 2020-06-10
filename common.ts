"user strict";
import { commands } from "vscode";
import { BuiltInCommands } from "./constants";

export enum ContextKeys {
	LiveShareInstalled = "codestream:liveShareInstalled",
	LiveShareSessionActive = "codestream:liveShareSessionActive",
	Status = "codestream:status"
}

export function setContext(key: ContextKeys | string, value: any) {
	return commands.executeCommand(BuiltInCommands.SetContext, key, value);
}

export enum GlobalState {
	AccessTokens = "codestream:accessTokens",
	Version = "codestream:version"
}

export enum WorkspaceState {
	webviewState = "codestream:webviewState",
	TeamId = "codestream:teamId"
}

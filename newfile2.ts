export function setContext(key: ContextKeys | string, value: any) {
	return commands.executeCommand(BuiltInCommands.SetContext, key, value);
}

export enum GlobalState {
	AccessTokens = "codestream:accessTokens",
	Version = "codestream:version"
}
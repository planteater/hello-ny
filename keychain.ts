// Copied from https://github.com/microsoft/vscode-pull-request-github/blob/df0b143714b6a17d74f8e22dddb0863d7e71fdb8/src/authentication/keychain.ts

// keytar depends on a native module shipped in vscode, so this is
// this is how we load it, local
import * as keytarType from "keytar";

function getNodeModule<T>(moduleName: string): T | undefined {
	// eslint-disable-next-line no-eval
	const vscodeRequire = eval("require");
	try {
		return vscodeRequire(moduleName);
	} catch (ex) {}
	return undefined;
}

export const keychain = getNodeModule<typeof keytarType>("keytar");

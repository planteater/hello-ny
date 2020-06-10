"use strict";

export const extensionId = "codestream";
export const extensionOutputChannelName = "CodeStream";
export const extensionQualifiedId = `CodeStream.${extensionId}`;

export enum BuiltInCommands {
	CloseActiveEditor = "workbench.action.closeActiveEditor",
	CloseAllEditors = "workbench.action.closeAllEditors",
	CursorMove = "cursorMove",
	Diff = "vscode.diff",
	EditorScroll = "editorScroll",
	ExecuteDocumentSymbolProvider = "vscode.executeDocumentSymbolProvider",
	ExecuteCodeLensProvider = "vscode.executeCodeLensProvider",
	GoToNextDiff = "workbench.action.compareEditor.nextChange",
	GoToPreviousDiff = "workbench.action.compareEditor.previousChange",
	GoToNextChangedFile = "codestream.showNextChangedFile",
	GoToPreviousChangedFile = "codestream.showPreviousChangedFile",
	IndentSelection = "editor.action.reindentselectedlines",
	FormatSelection = "editor.action.formatSelection",
	NextEditor = "workbench.action.nextEditor",
	Open = "vscode.open",
	PreviewHtml = "vscode.previewHtml",
	RevealLine = "revealLine",
	ReloadWindow = "workbench.action.reloadWindow",
	SetContext = "setContext",
	ShowCodeStream = "workbench.view.extension.codestream",
	ShowReferences = "editor.action.showReferences"
}

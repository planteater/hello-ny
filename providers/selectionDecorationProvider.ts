"use strict";
import {
	ConfigurationChangeEvent,
	DecorationOptions,
	Disposable,
	Position,
	TextEditor,
	TextEditorDecorationType,
	TextEditorSelectionChangeEvent,
	ThemeColor,
	window
} from "vscode";
import { SessionStatus, SessionStatusChangedEvent } from "../api/session";
import { configuration } from "../configuration";
import { Container } from "../container";

export class SelectionDecorationProvider implements Disposable {
	private _decorationTypes: { [key: string]: TextEditorDecorationType } | undefined;
	private readonly _disposable: Disposable;
	private _enabledDisposable: Disposable | undefined;

	constructor() {
		this._disposable = Disposable.from(
			configuration.onDidChange(this.onConfigurationChanged, this),
			Container.session.onDidChangeSessionStatus(this.onSessionStatusChanged, this)
		);

		this.onConfigurationChanged(configuration.initializingChangeEvent);
	}

	dispose() {
		this.disable();
		this._disposable && this._disposable.dispose();
	}

	private onConfigurationChanged(e: ConfigurationChangeEvent) {
		if (!configuration.changed(e, configuration.name("showShortcutTipOnSelection").value)) return;

		this.ensure();
	}

	private onSessionStatusChanged(e: SessionStatusChangedEvent) {
		switch (e.getStatus()) {
			case SessionStatus.SignedOut:
				this.disable();
				break;

			case SessionStatus.SignedIn:
				this.ensure();
				break;
		}
	}

	private ensure() {
		if (!Container.config.showShortcutTipOnSelection) {
			this.disable();

			return;
		}

		this.enable();
	}

	private disable() {
		if (this._enabledDisposable === undefined) return;

		this.clear();
		this._enabledDisposable && this._enabledDisposable.dispose();
	}

	private enable() {
		if (!Container.config.showShortcutTipOnSelection) {
			if (this._enabledDisposable === undefined) {
				this.disable();
			}

			return;
		}
		if (this._enabledDisposable !== undefined) return;

		const decorationTypes: { [key: string]: TextEditorDecorationType } = Object.create(null);

		const cssRules: { [key: string]: string | number } = {
			position: "absolute",
			padding: "2px 1ch 0 1ch",
			display: "inline-block",
			"pointer-events": "none",
			"font-size": "0.7rem",
			"z-index": 1
		};

		const aboveRules: { [key: string]: string | number } = {
			...cssRules,
			top: "calc(-1.25rem - 1px)",
			"border-radius": "5px 5px 5px 0"
		};
		const aboveCss = Object.entries(aboveRules)
			.map(([name, value]) => `${name}: ${value};`)
			.join(" ");

		decorationTypes.above = window.createTextEditorDecorationType({
			dark: {
				before: {
					textDecoration: "none; border-top:1px solid rgba(255, 255, 255, 0.05);"
				}
			},
			light: {
				before: {
					textDecoration: "none; border-top:1px solid rgba(0, 0, 0, 0.05);"
				}
			},
			before: {
				color: new ThemeColor("editor.foreground"),
				backgroundColor: new ThemeColor("editor.selectionBackground"),
				textDecoration: `none; ${aboveCss}`
			}
		});

		const belowRules: { [key: string]: string | number } = {
			...cssRules,
			top: "1.1rem",
			"border-radius": "0 5px 5px 5px"
		};
		const belowCss = Object.entries(belowRules)
			.map(([name, value]) => `${name}: ${value};`)
			.join(" ");

		decorationTypes.below = window.createTextEditorDecorationType({
			dark: {
				before: {
					textDecoration: "none; border-bottom:1px solid rgba(255, 255, 255, 0.05);"
				}
			},
			light: {
				before: {
					textDecoration: "none; border-bottom:1px solid rgba(0, 0, 0, 0.05);"
				}
			},
			before: {
				color: new ThemeColor("editor.foreground"),
				backgroundColor: new ThemeColor("editor.selectionBackground"),
				textDecoration: `none; ${belowCss}`
			}
		});

		this._decorationTypes = decorationTypes;
		this._enabledDisposable = Disposable.from(
			...Object.values(decorationTypes),
			window.onDidChangeTextEditorSelection(this.onTextEditorSelectionChanged, this)
		);
	}

	private async onTextEditorSelectionChanged(e: TextEditorSelectionChangeEvent) {
		if (e.selections.length === 0 || e.selections[0].isEmpty) {
			this.clear(e.textEditor);

			return;
		}

		this.apply(e.textEditor);
	}

	async apply(editor: TextEditor) {
		if (
			this._decorationTypes === undefined ||
			!Container.session.signedIn ||
			!this.isApplicableEditor(editor)
		) {
			return;
		}

		const above =
			editor.selection.active.line < editor.selection.end.line || editor.selection.isSingleLine;
		const range = above
			? editor.selection.with({ end: editor.selection.start })
			: editor.selection.with({
					start: new Position(editor.selection.end.line, 0),
					end: new Position(editor.selection.end.line, 0)
			  });

		const decorationOptions: DecorationOptions = {
			range: range,
			renderOptions: {
				before: {
					contentText: `Use ${
						process.platform === "darwin" ? "^/ C" : "Ctrl+Shift+/ Ctrl+Shift+C"
					} to comment on line${
						editor.selection.isSingleLine
							? ` ${editor.selection.start.line + 1}`
							: `s ${editor.selection.start.line + 1}-${editor.selection.end.line + 1}`
					}`
				}
			}
		};

		const activeDecorationType = above ? "above" : "below";
		for (const [name, decorationType] of Object.entries(this._decorationTypes)) {
			editor!.setDecorations(
				decorationType,
				name === activeDecorationType ? [decorationOptions] : []
			);
		}
	}

	clear(editor: TextEditor | undefined = window.activeTextEditor) {
		if (editor === undefined || this._decorationTypes === undefined) return;

		for (const decorationType of Object.values(this._decorationTypes)) {
			editor!.setDecorations(decorationType, []);
		}
	}

	private isApplicableEditor(editor: TextEditor | undefined) {
		return (
			editor !== undefined && editor.document !== undefined && editor.document.uri.scheme === "file"
		);
	}
}

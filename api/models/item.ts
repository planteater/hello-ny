"use strict";
import { CSEntity } from "@codestream/protocols/api";
import { CodeStreamSession } from "../session";

export abstract class CodeStreamItem<TEntity extends CSEntity> {
	constructor(public readonly session: CodeStreamSession, protected readonly entity: TEntity) {}

	get id() {
		return this.entity.id;
	}
}

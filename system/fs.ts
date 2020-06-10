"use strict";
import * as fs from "fs";

export namespace FileSystem {
	export function loadJsonFromFile<T>(file: string): Promise<T | undefined> {
		return new Promise(resolve => {
			fs.readFile(file, (err, data) => {
				if (err) {
					resolve(undefined);
					return;
				}

				try {
					resolve(JSON.parse(data.toString("utf8")));
				} catch (ex) {
					resolve(undefined);
				}
			});
		});
	}
}

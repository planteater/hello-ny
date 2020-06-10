"use strict";

export namespace Versions {
	export interface Version {
		major: number;
		minor: number;
		patch: number;
		pre?: string;
	}

	export function compare(v1: string | Version, v2: string | Version): number {
		if (typeof v1 === "string") {
			v1 = fromString(v1);
		}
		if (typeof v2 === "string") {
			v2 = fromString(v2);
		}

		if (v1.major > v2.major) return 1;
		if (v1.major < v2.major) return -1;

		if (v1.minor > v2.minor) return 1;
		if (v1.minor < v2.minor) return -1;

		if (v1.patch > v2.patch) return 1;
		if (v1.patch < v2.patch) return -1;

		if (v1.pre === undefined && v2.pre !== undefined) return 1;
		if (v1.pre !== undefined && v2.pre === undefined) return -1;

		if (v1.pre !== undefined && v2.pre !== undefined) return v1.pre.localeCompare(v2.pre);

		return 0;
	}

	export function from(
		major: string | number,
		minor: string | number,
		patch?: string | number,
		pre?: string
	): Version {
		return {
			major: typeof major === "string" ? parseInt(major, 10) : major,
			minor: typeof minor === "string" ? parseInt(minor, 10) : minor,
			patch: patch == null ? 0 : typeof patch === "string" ? parseInt(patch, 10) : patch,
			pre: pre
		};
	}

	export function fromString(version: string): Version {
		const [ver, pre] = version.split("-");
		const [major, minor, patch] = ver.split(".");
		return from(major, minor, patch, pre);
	}
}

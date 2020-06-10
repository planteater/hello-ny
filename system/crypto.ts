"use strict";
import * as crypto from "crypto";

export namespace Crypto {
	export function encrypt(text: string, algorithm: string, password: string) {
		const cipher = crypto.createCipher(algorithm, password);

		let encrypted = cipher.update(text, "utf8", "hex");
		encrypted += cipher.final("hex");

		return encrypted;
	}

	export function decrypt(text: string, algorithm: string, password: string) {
		const decipher = crypto.createDecipher(algorithm, password);

		let decrypted = decipher.update(text, "hex", "utf8");
		decrypted += decipher.final("utf8");

		return decrypted;
	}
}

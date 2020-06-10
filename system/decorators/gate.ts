"use strict";
import { Functions } from "./../function";

export function gate() {
	return (target: any, key: string, descriptor: PropertyDescriptor) => {
		if (!(typeof descriptor.value === "function")) throw new Error("not supported");

		const gateKey = `$gate$${key}`;
		const fn = descriptor.value;

		descriptor.value = function(this: any, ...args: any[]) {
			if (!this.hasOwnProperty(gateKey)) {
				Object.defineProperty(this, gateKey, {
					configurable: false,
					enumerable: false,
					writable: true,
					value: undefined
				});
			}

			let promise = this[gateKey];
			if (promise === undefined) {
				let result;
				try {
					result = fn!.apply(this, args);
					if (result == null || !Functions.isPromise(result)) {
						return result;
					}
					this[gateKey] = promise = result
						.then((r: any) => {
							this[gateKey] = undefined;
							return r;
						})
						.catch((ex: any) => {
							this[gateKey] = undefined;
							throw ex;
						});
				} catch (ex) {
					this[gateKey] = undefined;
					throw ex;
				}
			}

			return promise;
		};
	};
}

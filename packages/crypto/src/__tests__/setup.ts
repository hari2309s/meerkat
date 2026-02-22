import { webcrypto } from "node:crypto";

/**
 * Polyfill Web Crypto for Vitest node environment.
 * Node 20+ has this on globalThis, but Vitest versions or configurations
 * can sometimes miss it in the global scope of tests.
 */
if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", {
        value: webcrypto,
        writable: false,
        configurable: true,
    });
}

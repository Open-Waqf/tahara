/**
 * Tahara Crypto Utility
 * Uses Web Crypto API for AES-256-GCM encryption/decryption.
 * Part of the Privacy Vault implementation.
 */

export const TaharaCrypto = {
    /**
     * Generates a random 256-bit AES-GCM key.
     * @returns {Promise<CryptoKey>}
     */
    async generateKey() {
        return crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Exports a CryptoKey to a raw format (Uint8Array).
     * @param {CryptoKey} key 
     * @returns {Promise<Uint8Array>}
     */
    async exportKey(key) {
        const raw = await crypto.subtle.exportKey('raw', key);
        return new Uint8Array(raw);
    },

    /**
     * Imports a raw key into a CryptoKey object.
     * @param {Uint8Array} rawKey 
     * @returns {Promise<CryptoKey>}
     */
    async importKey(rawKey) {
        return crypto.subtle.importKey(
            'raw',
            rawKey,
            'AES-GCM',
            true,
            ['encrypt', 'decrypt']
        );
    },

    /**
     * Encrypts data using AES-256-GCM.
     * @param {Object} data - Plain text data (JSON serializable).
     * @param {CryptoKey} key - The AES key.
     * @returns {Promise<Uint8Array>} Combined IV and Ciphertext.
     */
    async encrypt(data, key) {
        const enc = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedData = enc.encode(JSON.stringify(data));

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encodedData
        );

        // Combine IV and Ciphertext for storage
        const combined = new Uint8Array(iv.length + ciphertext.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(ciphertext), iv.length);
        return combined;
    },

    /**
     * Decrypts data using AES-256-GCM.
     * @param {Uint8Array} combinedData - Combined IV and Ciphertext.
     * @param {CryptoKey} key - The AES key.
     * @returns {Promise<Object>} Decrypted data.
     */
    async decrypt(combinedData, key) {
        const dec = new TextDecoder();
        const iv = combinedData.slice(0, 12);
        const ciphertext = combinedData.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ciphertext
        );

        return JSON.parse(dec.decode(decrypted));
    }
};

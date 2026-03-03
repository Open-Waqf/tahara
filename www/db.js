/**
 * Tahara IndexedDB Manager
 * A lightweight wrapper for IndexedDB to handle sensitive health data.
 * Adheres to <500KB bundle size mandate.
 */

import { TaharaCrypto } from './crypto.js';

const DB_NAME = 'tahara_db';
const DB_VERSION = 1;
const STORES = {
    HISTORY: 'history',
    LOGS: 'logs',
    FASTING: 'fasting',
    STATUS: 'status'
};

export const TaharaDB = {
    db: null,
    isSupported: true,
    vaultKey: null, // The CryptoKey used for encryption

    /**
     * Sets the vault key for encryption/decryption.
     * @param {CryptoKey} key 
     */
    setVaultKey(key) {
        this.vaultKey = key;
    },

    /**
     * Initializes the IndexedDB database.
     * Maps schema versions to IndexedDB versions.
     */
    init() {
        return new Promise((resolve) => {
            if (this.db) return resolve(this.db);
            
            // Check if IndexedDB is available (e.g., restricted in some Private modes)
            if (!window.indexedDB) {
                console.warn("IndexedDB not supported/available");
                this.isSupported = false;
                return resolve(null);
            }

            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    const oldVersion = event.oldVersion;

                    // Version 1 initialization
                    if (oldVersion < 1) {
                        if (!db.objectStoreNames.contains(STORES.HISTORY)) {
                            db.createObjectStore(STORES.HISTORY);
                        }
                        if (!db.objectStoreNames.contains(STORES.LOGS)) {
                            db.createObjectStore(STORES.LOGS);
                        }
                        if (!db.objectStoreNames.contains(STORES.FASTING)) {
                            db.createObjectStore(STORES.FASTING);
                        }
                        if (!db.objectStoreNames.contains(STORES.STATUS)) {
                            db.createObjectStore(STORES.STATUS);
                        }
                    }
                };

                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    resolve(this.db);
                };

                request.onerror = (event) => {
                    console.error("IndexedDB open error:", event.target.error);
                    // Handle private mode restrictions where open might fail
                    this.isSupported = false;
                    resolve(null);
                };
            } catch (e) {
                console.error("IndexedDB init exception:", e);
                this.isSupported = false;
                resolve(null);
            }
        });
    },

    /**
     * Generic get method
     */
    get(storeName, key = 'data') {
        return new Promise((resolve) => {
            if (!this.db) return resolve(null);
            try {
                const transaction = this.db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = async () => {
                    let result = request.result;
                    if (result && this.vaultKey && (result instanceof Uint8Array)) {
                        try {
                            result = await TaharaCrypto.decrypt(result, this.vaultKey);
                        } catch (e) {
                            console.error("Decryption failed:", e);
                            return resolve(null);
                        }
                    }
                    resolve(result);
                };
                request.onerror = () => {
                    console.error("Get error:", request.error);
                    resolve(null);
                };
            } catch (e) {
                console.error("Get transaction error:", e);
                resolve(null);
            }
        });
    },

    /**
     * Generic set method
     */
    set(storeName, value, key = 'data') {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            (async () => {
                try {
                    let finalValue = value;
                    if (this.vaultKey) {
                        finalValue = await TaharaCrypto.encrypt(value, this.vaultKey);
                    }
                    const transaction = this.db.transaction(storeName, 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.put(finalValue, key);

                    request.onsuccess = () => resolve(true);
                    request.onerror = () => {
                        console.error("Set error:", request.error);
                        resolve(false);
                    };
                } catch (e) {
                    console.error("Set transaction error:", e);
                    resolve(false);
                }
            })();
        });
    },

    /**
     * Clears all sensitive data from IndexedDB
     */
    async clearAll() {
        if (!this.db) await this.init();
        if (!this.db) return;
        
        const promises = Object.values(STORES).map(storeName => {
            return new Promise((resolve) => {
                try {
                    const transaction = this.db.transaction(storeName, 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => resolve();
                } catch (e) {
                    resolve();
                }
            });
        });
        await Promise.all(promises);
    },

    /**
     * Completely destroys the IndexedDB database.
     */
    async deleteDatabase() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        return new Promise((resolve) => {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
            request.onblocked = () => resolve(false);
        });
    },

    /**
     * Closes the database connection to free up memory.
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
};

export { STORES };

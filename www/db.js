/**
 * Tahara IndexedDB Manager
 * A lightweight wrapper for IndexedDB to handle sensitive health data.
 * Adheres to <500KB bundle size mandate.
 */

import { TaharaCrypto } from './crypto.js';

const DB_NAME = 'tahara_db';
const DB_VERSION = 1;
const LEGACY_SCHEMA_VERSION_KEY = 'tahara_schema_version';
const MIGRATION_VERIFIED_KEY = 'tahara_migration_verified';
const MIGRATION_STATE_KEY = 'tahara_migration_state';
const STORES = {
    HISTORY: 'history',
    LOGS: 'logs',
    FASTING: 'fasting',
    STATUS: 'status'
};

const LEGACY_KEYS = {
    HISTORY: 'tahara_history',
    LOGS: 'tahara_logs',
    FASTING: 'tahara_fasting',
    STATUS: 'tahara_status',
    LAST_CHANGED: 'tahara_last_changed'
};

function parseJSONOr(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed === null ? fallback : parsed;
    } catch {
        return fallback;
    }
}

function tryParseJSON(raw, fallback) {
    if (raw === null || raw === undefined) return {ok: true, value: fallback};
    try {
        const parsed = JSON.parse(raw);
        return {ok: true, value: parsed === null ? fallback : parsed};
    } catch {
        return {ok: false, value: fallback};
    }
}

function normalizeHistory(raw) {
    return Array.isArray(raw) ? raw : [];
}

function normalizeFasting(raw) {
    if (!raw || typeof raw !== 'object') return {missed: 0, paid: 0};
    return {
        missed: Number.isFinite(Number(raw.missed)) ? Number(raw.missed) : 0,
        paid: Number.isFinite(Number(raw.paid)) ? Number(raw.paid) : 0
    };
}

function normalizeLogs(raw) {
    return raw && typeof raw === 'object' ? raw : {};
}

function normalizeStatus(status, lastChanged, nowProvider) {
    const safeStatus = status === 'hayd' ? 'hayd' : 'purity';
    const safeLastChanged = typeof lastChanged === 'string' && !Number.isNaN(Date.parse(lastChanged))
        ? lastChanged
        : nowProvider();
    return {status: safeStatus, lastChanged: safeLastChanged};
}

function hasAnyLegacyData(storage) {
    return [
        LEGACY_KEYS.HISTORY,
        LEGACY_KEYS.LOGS,
        LEGACY_KEYS.FASTING,
        LEGACY_KEYS.STATUS,
        LEGACY_KEYS.LAST_CHANGED
    ].some((key) => storage.getItem(key) !== null);
}

function readMigrationState(storage) {
    return parseJSONOr(storage.getItem(MIGRATION_STATE_KEY), null);
}

function markMigrationState(storage, phase) {
    storage.setItem(MIGRATION_STATE_KEY, JSON.stringify({
        phase,
        at: new Date().toISOString()
    }));
}

function clearLegacyData(storage) {
    storage.removeItem(LEGACY_KEYS.HISTORY);
    storage.removeItem(LEGACY_KEYS.LOGS);
    storage.removeItem(LEGACY_KEYS.FASTING);
    storage.removeItem(LEGACY_KEYS.STATUS);
    storage.removeItem(LEGACY_KEYS.LAST_CHANGED);
}

function isValidStatusData(data) {
    return !!data
        && typeof data === 'object'
        && (data.status === 'purity' || data.status === 'hayd')
        && typeof data.lastChanged === 'string';
}

/**
 * Migrates legacy localStorage data into IndexedDB in a resume-safe manner.
 * - Never deletes legacy data unless IndexedDB verification succeeds.
 * - Supports interrupted runs by using a migration-state marker.
 * - Avoids overwriting valid IndexedDB stores with default values when legacy keys are already removed.
 */
export async function migrateLegacyLocalStorageToIndexedDB({
    dbManager,
    storage,
    currentSchemaVersion,
    logger = console,
    nowProvider = () => new Date().toISOString()
}) {
    if (!dbManager || !storage) return {migrated: false, verified: false};

    const migrationState = readMigrationState(storage);
    const shouldAttemptMigration = hasAnyLegacyData(storage) || !!migrationState;

    if (shouldAttemptMigration) {
        markMigrationState(storage, 'started');

        try {
            const hasLegacyHistory = storage.getItem(LEGACY_KEYS.HISTORY) !== null;
            const hasLegacyFasting = storage.getItem(LEGACY_KEYS.FASTING) !== null;
            const hasLegacyLogs = storage.getItem(LEGACY_KEYS.LOGS) !== null;
            const hasLegacyStatus = storage.getItem(LEGACY_KEYS.STATUS) !== null || storage.getItem(LEGACY_KEYS.LAST_CHANGED) !== null;
            let parseFailed = false;

            if (hasLegacyHistory) {
                const parsedHistory = tryParseJSON(storage.getItem(LEGACY_KEYS.HISTORY), []);
                parseFailed = parseFailed || !parsedHistory.ok;
                const history = normalizeHistory(parsedHistory.value);
                await dbManager.set(STORES.HISTORY, history);
            }
            if (hasLegacyFasting) {
                const parsedFasting = tryParseJSON(storage.getItem(LEGACY_KEYS.FASTING), {missed: 0, paid: 0});
                parseFailed = parseFailed || !parsedFasting.ok;
                const fasting = normalizeFasting(parsedFasting.value);
                await dbManager.set(STORES.FASTING, fasting);
            }
            if (hasLegacyLogs) {
                const parsedLogs = tryParseJSON(storage.getItem(LEGACY_KEYS.LOGS), {});
                parseFailed = parseFailed || !parsedLogs.ok;
                const logs = normalizeLogs(parsedLogs.value);
                await dbManager.set(STORES.LOGS, logs);
            }
            if (hasLegacyStatus) {
                const statusData = normalizeStatus(
                    storage.getItem(LEGACY_KEYS.STATUS),
                    storage.getItem(LEGACY_KEYS.LAST_CHANGED),
                    nowProvider
                );
                await dbManager.set(STORES.STATUS, statusData);
            }

            markMigrationState(storage, 'written');

            const [migratedHistory, migratedFasting, migratedLogs, migratedStatus] = await Promise.all([
                dbManager.get(STORES.HISTORY),
                dbManager.get(STORES.FASTING),
                dbManager.get(STORES.LOGS),
                dbManager.get(STORES.STATUS)
            ]);

            const historyVerified = hasLegacyHistory ? Array.isArray(migratedHistory) : true;
            const fastingVerified = hasLegacyFasting ? (!!migratedFasting && typeof migratedFasting === 'object') : true;
            const logsVerified = hasLegacyLogs ? (!!migratedLogs && typeof migratedLogs === 'object') : true;
            const statusVerified = hasLegacyStatus ? isValidStatusData(migratedStatus) : true;
            const verified = !parseFailed && historyVerified && fastingVerified && logsVerified && statusVerified;

            if (verified) {
                clearLegacyData(storage);
                storage.setItem(MIGRATION_VERIFIED_KEY, 'true');
                storage.removeItem(MIGRATION_STATE_KEY);
                if (logger && typeof logger.log === 'function') {
                    logger.log('Legacy migration to IndexedDB verified.');
                }
            } else {
                storage.setItem(MIGRATION_VERIFIED_KEY, 'failed');
                markMigrationState(storage, 'verification_failed');
                if (logger && typeof logger.error === 'function') {
                    logger.error('Migration verification failed. Legacy localStorage was preserved.');
                }
            }
        } catch (err) {
            storage.setItem(MIGRATION_VERIFIED_KEY, 'failed');
            markMigrationState(storage, 'error');
            if (logger && typeof logger.error === 'function') {
                logger.error('Migration execution failed. Legacy localStorage was preserved.', err);
            }
        }
    }

    storage.setItem(LEGACY_SCHEMA_VERSION_KEY, String(currentSchemaVersion));
    return {
        migrated: shouldAttemptMigration,
        verified: storage.getItem(MIGRATION_VERIFIED_KEY) === 'true'
    };
}

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
                    if (result instanceof Uint8Array && !this.vaultKey) {
                        // Vault is enabled but still locked; avoid leaking encrypted blobs into app state.
                        return resolve(null);
                    }
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

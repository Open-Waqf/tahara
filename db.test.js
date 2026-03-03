import {afterEach, describe, expect, it, vi} from 'vitest';
import {migrateLegacyLocalStorageToIndexedDB, STORES, TaharaDB} from './www/db.js';
import {TaharaCrypto} from './www/crypto.js';

function mockDbGet(result, shouldError = false) {
    return {
        transaction() {
            return {
                objectStore() {
                    return {
                        get() {
                            const request = {result: undefined, error: null, onsuccess: null, onerror: null};
                            setTimeout(() => {
                                if (shouldError) {
                                    request.error = new Error('mock get error');
                                    if (request.onerror) request.onerror();
                                } else {
                                    request.result = result;
                                    if (request.onsuccess) request.onsuccess();
                                }
                            }, 0);
                            return request;
                        }
                    };
                }
            };
        }
    };
}

describe('TaharaDB.get vault behavior', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        TaharaDB.db = null;
        TaharaDB.vaultKey = null;
    });

    it('returns null for encrypted blob when vault key is not available', async () => {
        TaharaDB.db = mockDbGet(new Uint8Array([1, 2, 3]));
        TaharaDB.vaultKey = null;

        const res = await TaharaDB.get('history');
        expect(res).toBeNull();
    });

    it('returns plain object as-is when value is not encrypted', async () => {
        const data = {a: 1};
        TaharaDB.db = mockDbGet(data);
        TaharaDB.vaultKey = null;

        const res = await TaharaDB.get('history');
        expect(res).toEqual(data);
    });

    it('decrypts encrypted blob when vault key is present', async () => {
        const decrypted = {status: 'hayd'};
        const decryptSpy = vi.spyOn(TaharaCrypto, 'decrypt').mockResolvedValue(decrypted);
        TaharaDB.db = mockDbGet(new Uint8Array([9, 9, 9]));
        TaharaDB.vaultKey = {fake: 'key'};

        const res = await TaharaDB.get('status');
        expect(res).toEqual(decrypted);
        expect(decryptSpy).toHaveBeenCalledOnce();
    });

    it('returns null when decryption fails', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(TaharaCrypto, 'decrypt').mockRejectedValue(new Error('decrypt fail'));
        TaharaDB.db = mockDbGet(new Uint8Array([9]));
        TaharaDB.vaultKey = {fake: 'key'};

        const res = await TaharaDB.get('status');
        expect(res).toBeNull();
        expect(errSpy).toHaveBeenCalled();
    });
});

function createMemoryStorage(seed = {}) {
    const map = new Map(Object.entries(seed));
    return {
        getItem(key) {
            return map.has(key) ? map.get(key) : null;
        },
        setItem(key, value) {
            map.set(key, String(value));
        },
        removeItem(key) {
            map.delete(key);
        }
    };
}

function createMockDb(seed = {}) {
    const store = {
        [STORES.HISTORY]: seed[STORES.HISTORY] ?? null,
        [STORES.FASTING]: seed[STORES.FASTING] ?? null,
        [STORES.LOGS]: seed[STORES.LOGS] ?? null,
        [STORES.STATUS]: seed[STORES.STATUS] ?? null
    };

    return {
        async set(storeName, value) {
            store[storeName] = value;
            return true;
        },
        async get(storeName) {
            return store[storeName];
        },
        store
    };
}

describe('migrateLegacyLocalStorageToIndexedDB', () => {
    it('migrates legacy data and clears localStorage only after verification', async () => {
        const storage = createMemoryStorage({
            tahara_history: JSON.stringify([{status: 'hayd', time: '2026-03-01T00:00:00.000Z'}]),
            tahara_fasting: JSON.stringify({missed: 2, paid: 1}),
            tahara_logs: JSON.stringify({'2026-03-01': ['sym_pain']}),
            tahara_status: 'hayd',
            tahara_last_changed: '2026-03-01T00:00:00.000Z'
        });
        const db = createMockDb();

        const result = await migrateLegacyLocalStorageToIndexedDB({
            dbManager: db,
            storage,
            currentSchemaVersion: 4,
            logger: {log() {}, error() {}}
        });

        expect(result).toEqual({migrated: true, verified: true});
        expect(db.store[STORES.HISTORY]).toEqual([{status: 'hayd', time: '2026-03-01T00:00:00.000Z'}]);
        expect(db.store[STORES.FASTING]).toEqual({missed: 2, paid: 1});
        expect(db.store[STORES.LOGS]).toEqual({'2026-03-01': ['sym_pain']});
        expect(db.store[STORES.STATUS]).toEqual({status: 'hayd', lastChanged: '2026-03-01T00:00:00.000Z'});
        expect(storage.getItem('tahara_history')).toBeNull();
        expect(storage.getItem('tahara_fasting')).toBeNull();
        expect(storage.getItem('tahara_logs')).toBeNull();
        expect(storage.getItem('tahara_status')).toBeNull();
        expect(storage.getItem('tahara_last_changed')).toBeNull();
        expect(storage.getItem('tahara_migration_verified')).toBe('true');
        expect(storage.getItem('tahara_schema_version')).toBe('4');
    });

    it('preserves legacy data when verification fails', async () => {
        const storage = createMemoryStorage({
            tahara_history: JSON.stringify([{status: 'purity', time: '2026-03-01T00:00:00.000Z'}]),
            tahara_fasting: JSON.stringify({missed: 1, paid: 0})
        });
        const db = createMockDb({
            [STORES.FASTING]: null,
            [STORES.LOGS]: null,
            [STORES.STATUS]: null
        });

        db.get = vi.fn(async (storeName) => {
            if (storeName === STORES.FASTING) return null;
            if (storeName === STORES.LOGS) return null;
            if (storeName === STORES.STATUS) return null;
            return db.store[storeName];
        });

        const result = await migrateLegacyLocalStorageToIndexedDB({
            dbManager: db,
            storage,
            currentSchemaVersion: 2,
            logger: {log() {}, error() {}}
        });

        expect(result).toEqual({migrated: true, verified: false});
        expect(storage.getItem('tahara_history')).not.toBeNull();
        expect(storage.getItem('tahara_migration_verified')).toBe('failed');
        expect(storage.getItem('tahara_migration_state')).not.toBeNull();
        expect(storage.getItem('tahara_schema_version')).toBe('2');
    });

    it('resumes safely when migration was interrupted and only some legacy keys remain', async () => {
        const storage = createMemoryStorage({
            tahara_logs: JSON.stringify({'2026-03-02': ['sym_sleep']}),
            tahara_migration_state: JSON.stringify({phase: 'started', at: '2026-03-03T00:00:00.000Z'})
        });
        const db = createMockDb({
            [STORES.HISTORY]: [{status: 'purity', time: '2026-03-01T00:00:00.000Z'}],
            [STORES.FASTING]: {missed: 0, paid: 0},
            [STORES.STATUS]: {status: 'purity', lastChanged: '2026-03-01T00:00:00.000Z'}
        });

        const result = await migrateLegacyLocalStorageToIndexedDB({
            dbManager: db,
            storage,
            currentSchemaVersion: 7,
            logger: {log() {}, error() {}}
        });

        expect(result).toEqual({migrated: true, verified: true});
        expect(db.store[STORES.LOGS]).toEqual({'2026-03-02': ['sym_sleep']});
        expect(storage.getItem('tahara_logs')).toBeNull();
        expect(storage.getItem('tahara_migration_state')).toBeNull();
        expect(storage.getItem('tahara_migration_verified')).toBe('true');
        expect(storage.getItem('tahara_schema_version')).toBe('7');
    });

    it('verifies and clears migration when optional legacy keys are missing', async () => {
        const storage = createMemoryStorage({
            tahara_history: JSON.stringify([{status: 'hayd', time: '2026-03-01T00:00:00.000Z'}]),
            tahara_fasting: JSON.stringify({missed: 5, paid: 2}),
            tahara_status: 'hayd',
            tahara_last_changed: '2026-03-01T00:00:00.000Z'
        });
        const db = createMockDb();

        const result = await migrateLegacyLocalStorageToIndexedDB({
            dbManager: db,
            storage,
            currentSchemaVersion: 3,
            logger: {log() {}, error() {}}
        });

        expect(result).toEqual({migrated: true, verified: true});
        expect(storage.getItem('tahara_history')).toBeNull();
        expect(storage.getItem('tahara_fasting')).toBeNull();
        expect(storage.getItem('tahara_status')).toBeNull();
        expect(storage.getItem('tahara_last_changed')).toBeNull();
        expect(storage.getItem('tahara_migration_verified')).toBe('true');
    });

    it('preserves malformed legacy JSON and marks migration failed', async () => {
        const storage = createMemoryStorage({
            tahara_history: '{broken_json]',
            tahara_status: 'hayd',
            tahara_last_changed: '2026-03-01T00:00:00.000Z'
        });
        const db = createMockDb();

        const result = await migrateLegacyLocalStorageToIndexedDB({
            dbManager: db,
            storage,
            currentSchemaVersion: 5,
            logger: {log() {}, error() {}}
        });

        expect(result).toEqual({migrated: true, verified: false});
        expect(storage.getItem('tahara_history')).toBe('{broken_json]');
        expect(storage.getItem('tahara_migration_verified')).toBe('failed');
    });
});

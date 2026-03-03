import {afterEach, describe, expect, it, vi} from 'vitest';
import {TaharaDB} from './www/db.js';
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

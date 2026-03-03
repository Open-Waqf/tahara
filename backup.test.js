import {describe, expect, it} from 'vitest';
import {normalizeBackupData} from './www/backup.js';
import {APP_LIMITS} from './www/constants.js';

describe('normalizeBackupData', () => {
    it('rejects invalid top-level payloads', () => {
        expect(normalizeBackupData(null)).toBeNull();
        expect(normalizeBackupData({})).toBeNull();
        expect(normalizeBackupData({tahara_status: 'bad', tahara_history: []})).toBeNull();
        expect(normalizeBackupData({tahara_status: 'hayd', tahara_history: {}})).toBeNull();
    });

    it('normalizes dates, fasting bounds, and bad entries safely', () => {
        const now = new Date('2026-03-03T00:00:00.000Z');
        const payload = {
            schema_version: '3',
            tahara_status: 'hayd',
            tahara_history: [
                {status: 'hayd', time: '2026-03-01T12:00:00.000Z'},
                {status: 'unknown', time: '2026-03-01T12:00:00.000Z'},
                {status: 'purity', time: 'bad-date'}
            ],
            tahara_fasting: {missed: '-5', paid: '100'},
            tahara_logs: {},
            tahara_last_changed: 'bad-date',
            export_date: 'bad-date'
        };

        const result = normalizeBackupData(payload, now);
        expect(result.schema_version).toBe(3);
        expect(result.tahara_history).toEqual([{status: 'hayd', time: '2026-03-01T12:00:00.000Z'}]);
        expect(result.tahara_fasting).toEqual({missed: 0, paid: 0});
        expect(result.tahara_last_changed).toBe('2026-03-01T12:00:00.000Z');
        expect(result.export_date).toBe('2026-03-03T00:00:00.000Z');
    });

    it('bounds large logs payload (performance guard)', () => {
        const bigLogs = {};
        const start = new Date('2000-01-01T00:00:00.000Z');
        for (let i = 0; i < 6000; i++) {
            const d = new Date(start.getTime() + i * 86400000);
            const key = d.toISOString().split('T')[0];
            bigLogs[key] = Array.from({length: 100}, (_, n) => `tag_${n}`);
        }

        const payload = {
            tahara_status: 'purity',
            tahara_history: [{status: 'purity', time: '2026-02-01T00:00:00.000Z'}],
            tahara_fasting: {missed: 1, paid: 0},
            tahara_logs: bigLogs,
            tahara_last_changed: '2026-02-01T00:00:00.000Z',
            export_date: '2026-02-01T00:00:00.000Z'
        };

        const result = normalizeBackupData(payload);
        const logEntries = Object.entries(result.tahara_logs);
        expect(logEntries.length).toBeLessThanOrEqual(APP_LIMITS.MAX_BACKUP_LOG_DAYS);
        for (const [, tags] of logEntries) {
            expect(tags.length).toBeLessThanOrEqual(APP_LIMITS.MAX_BACKUP_TAGS_PER_DAY);
        }
    });
});

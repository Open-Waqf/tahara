// engine.test.js
import {describe, expect, it} from 'vitest';
import {TaharaEngine} from './www/engine.js';

describe('TaharaEngine.calculateAverages', () => {
    it('returns 0 for empty or insufficient history', () => {
        const result1 = TaharaEngine.calculateAverages([]);
        const result2 = TaharaEngine.calculateAverages([{status: 'hayd', time: new Date().toISOString()}]);

        expect(result1.avgCycleLengthMs).toBe(0);
        expect(result2.avgCycleLengthMs).toBe(0);
    });

    it('calculates averages correctly for two full cycles', () => {
        const DAY_MS = 86400000;
        const now = new Date().getTime();

        // Mocking 2 cycles:
        // Cycle 1: 5 days Hayd, 20 days Purity (25 days total)
        // Cycle 2: 7 days Hayd, 21 days Purity (28 days total)
        const history = [
            {status: 'hayd', time: new Date(now).toISOString()}, // Current cycle start
            {status: 'purity', time: new Date(now - (21 * DAY_MS)).toISOString()},
            {status: 'hayd', time: new Date(now - (28 * DAY_MS)).toISOString()}, // Cycle 2 start
            {status: 'purity', time: new Date(now - (48 * DAY_MS)).toISOString()},
            {status: 'hayd', time: new Date(now - (53 * DAY_MS)).toISOString()}, // Cycle 1 start
        ];

        const result = TaharaEngine.calculateAverages(history);

        // Average Cycle = (28 + 25) / 2 = 26.5 days
        expect(result.avgCycleLengthMs).toBe(26.5 * DAY_MS);

        // Average Hayd = (7 + 5) / 2 = 6 days
        expect(result.avgHaydLengthMs).toBe(6 * DAY_MS);
    });
});

describe('TaharaEngine.getFiqhContext', () => {
    it('triggers Hanafi warning at 10 days of Hayd', () => {
        const tenDaysAgo = new Date(Date.now() - (10 * 86400000)).toISOString();
        const context = TaharaEngine.getFiqhContext('hayd', tenDaysAgo, new Date());

        expect(context.isWarning).toBe(true);
        expect(context.ruleKey).toBe('msg_hayd_warning_hanafi');
    });

    it('triggers Shafi warning at 15 days of Hayd', () => {
        const fifteenDaysAgo = new Date(Date.now() - (15 * 86400000)).toISOString();
        const context = TaharaEngine.getFiqhContext('hayd', fifteenDaysAgo, new Date());

        expect(context.isWarning).toBe(true);
        expect(context.ruleKey).toBe('msg_hayd_warning_shafi');
    });

    it('shows general message for normal Hayd (e.g., day 5)', () => {
        const fiveDaysAgo = new Date(Date.now() - (5 * 86400000)).toISOString();
        const context = TaharaEngine.getFiqhContext('hayd', fiveDaysAgo, new Date());

        expect(context.isWarning).toBe(false);
        expect(context.ruleKey).toBe('msg_hayd_generic');
    });
});
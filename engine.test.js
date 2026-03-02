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

describe('TaharaEngine.predictNextCycle', () => {
    it('handles insufficient data safely (Test Case 1)', () => {
        const history = [{status: 'hayd', time: new Date().toISOString()}];
        const result = TaharaEngine.predictNextCycle(history, 0, 0);
        expect(result).toEqual({predStart: null, predEnd: null});
    });

    it('accurately projects future dates (Test Case 2)', () => {
        const DAY_MS = 86400000;
        const lastHaydTime = Date.now() - (20 * DAY_MS);
        const history = [{status: 'hayd', time: new Date(lastHaydTime).toISOString()}];
        
        const avgCycle = 28 * DAY_MS;
        const avgHayd = 6 * DAY_MS;
        
        const result = TaharaEngine.predictNextCycle(history, avgCycle, avgHayd);
        
        expect(result.predStart.getTime()).toBe(lastHaydTime + avgCycle);
        expect(result.predEnd.getTime()).toBe(lastHaydTime + avgCycle + avgHayd);
    });
});

describe('TaharaEngine.getFiqhContext (New Cases)', () => {
    it('Day 0 Purity time-of-day logic (Test Case 3)', () => {
        const lastChanged = new Date().toISOString();
        
        // Morning (9 AM)
        const morning = new Date(); morning.setHours(9, 0, 0);
        const ctxMorning = TaharaEngine.getFiqhContext('purity', lastChanged, morning);
        expect(ctxMorning.ruleKey).toBe('msg_purity_day0_morning');
        expect(ctxMorning.isAlert).toBe(true);

        // Afternoon (1 PM)
        const afternoon = new Date(); afternoon.setHours(13, 0, 0);
        const ctxAfternoon = TaharaEngine.getFiqhContext('purity', lastChanged, afternoon);
        expect(ctxAfternoon.ruleKey).toBe('msg_purity_day0_afternoon');
        expect(ctxAfternoon.isAlert).toBe(true);

        // Evening (8 PM)
        const evening = new Date(); evening.setHours(20, 0, 0);
        const ctxEvening = TaharaEngine.getFiqhContext('purity', lastChanged, evening);
        expect(ctxEvening.ruleKey).toBe('msg_purity_day0_evening');
        expect(ctxEvening.isAlert).toBe(true);
    });

    it('Early Hayd Warning (Test Case 4)', () => {
        const DAY_MS = 86400000;
        const twoDaysAgo = new Date(Date.now() - (2 * DAY_MS)).toISOString();
        const context = TaharaEngine.getFiqhContext('hayd', twoDaysAgo, new Date());

        expect(context.ruleKey).toBe('msg_hayd_early');
        expect(context.isWarning).toBe(false);
    });
});

describe('TaharaEngine.calculateAverages (Extra)', () => {
    it('handles zero Hayd entries (Test Case 5)', () => {
        const history = [
            {status: 'purity', time: new Date().toISOString()},
            {status: 'purity', time: new Date(Date.now() - 86400000).toISOString()}
        ];
        const result = TaharaEngine.calculateAverages(history);
        expect(result.avgCycleLengthMs).toBe(0);
        expect(result.avgHaydLengthMs).toBe(0);
    });
});
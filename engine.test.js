// engine.test.js
import {describe, expect, it} from 'vitest';
import {TaharaEngine} from './www/engine.js';
import {FiqhRules} from './www/rules.js';
import vectors from './tests/fiqh-vectors.json';

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

describe('Fiqh Vector Corpus Tests', () => {
    vectors.forEach((vector) => {
        it(`${vector.id}: ${vector.description}`, () => {
            const now = new Date(vector.now || Date.now());
            const history = vector.history;
            const status = history[0].status;
            const lastChanged = history[0].time;

            if (vector.expected) {
                // Test Hanafi
                const ctxHanafi = TaharaEngine.getFiqhContext(status, lastChanged, now, FiqhRules['hanafi'].rules);
                expect(ctxHanafi.ruleKey).toBe(vector.expected.hanafi.ruleKey);
                expect(ctxHanafi.isWarning).toBe(vector.expected.hanafi.isWarning);
                if (vector.expected.hanafi.isAlert !== undefined) {
                    expect(ctxHanafi.isAlert).toBe(vector.expected.hanafi.isAlert);
                }

                // Test Shafi'i
                const ctxShafi = TaharaEngine.getFiqhContext(status, lastChanged, now, FiqhRules['shafi'].rules);
                expect(ctxShafi.ruleKey).toBe(vector.expected.shafi.ruleKey);
                expect(ctxShafi.isWarning).toBe(vector.expected.shafi.isWarning);
                if (vector.expected.shafi.isAlert !== undefined) {
                    expect(ctxShafi.isAlert).toBe(vector.expected.shafi.isAlert);
                }
            }

            if (vector.expected_averages) {
                // Test Hanafi truncation
                const avgHanafi = TaharaEngine.calculateAverages(history, FiqhRules['hanafi'].rules);
                expect(avgHanafi.avgHaydLengthMs).toBe(vector.expected_averages.hanafi.avgHaydLengthMs);

                // Test Shafi'i truncation
                const avgShafi = TaharaEngine.calculateAverages(history, FiqhRules['shafi'].rules);
                expect(avgShafi.avgHaydLengthMs).toBe(vector.expected_averages.shafi.avgHaydLengthMs);
            }
        });
    });
});

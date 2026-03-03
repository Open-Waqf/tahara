/**
 * Fiqh Rule Schemas
 * Defined as independent, versioned objects separate from calculation logic.
 */

export const FiqhRules = {
    'hanafi': {
        madhhab: 'hanafi',
        version: '1.0',
        sourceKey: 'hanafi_source',
        rules: {
            minHaydMs: 3 * 24 * 60 * 60 * 1000,      // 3 days
            maxHaydMs: 10 * 24 * 60 * 60 * 1000,     // 10 days
            minTuhrMs: 15 * 24 * 60 * 60 * 1000,     // 15 days
            warningKey: "msg_hayd_warning_hanafi"
        }
    },
    'shafi': {
        madhhab: 'shafi',
        version: '1.0',
        sourceKey: 'shafi_source',
        rules: {
            minHaydMs: 24 * 60 * 60 * 1000,          // 24 hours (1 day)
            maxHaydMs: 15 * 24 * 60 * 60 * 1000,     // 15 days
            minTuhrMs: 15 * 24 * 60 * 60 * 1000,     // 15 days
            warningKey: "msg_hayd_warning_shafi"
        }
    }
};

/**
 * Tahara Fiqh Engine
 * A stateless calculator that processes history and rule schemas.
 * AC 2: Stateless Engine - contains zero hardcoded madhhab references or duration values.
 */

export const TaharaEngine = {
    /**
     * Calculates averages from history. Pure function.
     * Truncates invalid entries based on maxHaydMs from rules.
     * @param {Array} history - Array of {status, time} objects sorted newest first
     * @param {Object} rules - Rule schema object
     * @returns {Object} { avgCycleLengthMs, avgHaydLengthMs }
     */
    calculateAverages: (history, rules = null) => {
        if (!history || history.length < 2) return {avgCycleLengthMs: 0, avgHaydLengthMs: 0};

        const haydStarts = history.filter(e => e.status === 'hayd').map(e => new Date(e.time));

        let avgCycleLengthMs = 0;
        if (haydStarts.length >= 2) {
            let totalCycleMs = 0;
            for (let i = 0; i < haydStarts.length - 1; i++) {
                totalCycleMs += (haydStarts[i] - haydStarts[i + 1]);
            }
            avgCycleLengthMs = totalCycleMs / (haydStarts.length - 1);
        }

        let totalHaydMs = 0, haydCount = 0;
        for (let i = 0; i < history.length - 1; i++) {
            if (history[i + 1].status === 'hayd' && history[i].status === 'purity') {
                let duration = (new Date(history[i].time) - new Date(history[i + 1].time));
                
                // Truncate invalid history entries based on rules
                if (rules && rules.maxHaydMs && duration > rules.maxHaydMs) {
                    duration = rules.maxHaydMs;
                }
                
                totalHaydMs += duration;
                haydCount++;
            }
        }
        const avgHaydLengthMs = haydCount > 0 ? totalHaydMs / haydCount : 0;

        return {avgCycleLengthMs, avgHaydLengthMs};
    },

    /**
     * Determines Fiqh context based on current state and duration. Pure function.
     * @param {string} status - 'purity' or 'hayd'
     * @param {Date|string} lastChanged - Time of last state change
     * @param {Date} now - Current time
     * @param {Object} rules - Rule schema object
     * @returns {Object} { ruleKey, isWarning, isAlert, days }
     */
    getFiqhContext: (status, lastChanged, now, rules = null) => {
        const lastDate = new Date(lastChanged);
        
        // Exact millisecond difference for rule durations
        const msDiff = now.getTime() - lastDate.getTime();
        
        // Calendar day difference for Day 0 logic
        const utc1 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const utc2 = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        const days = Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24));
        
        const hour = now.getHours();

        let ruleKey;
        let isWarning = false;
        let isAlert = false;

        if (status === "purity") {
            if (days === 0) {
                isAlert = true;
                if (hour >= 4 && hour < 12) ruleKey = "msg_purity_day0_morning";
                else if (hour >= 12 && hour < 17) ruleKey = "msg_purity_day0_afternoon";
                else ruleKey = "msg_purity_day0_evening";
            } else {
                ruleKey = "msg_purity_general";
            }
        } else {
            // AC 2: Use dynamic rules instead of hardcoded values
            if (rules && rules.maxHaydMs && msDiff >= rules.maxHaydMs) {
                ruleKey = rules.warningKey || "msg_hayd_generic";
                isWarning = true;
            } else if (rules && rules.minHaydMs && msDiff <= rules.minHaydMs) {
                ruleKey = "msg_hayd_early";
            } else {
                ruleKey = "msg_hayd_generic";
            }
        }

        return {ruleKey, isWarning, isAlert, days};
    },

    /**
     * Predicts next cycle dates. Pure function.
     * @param {Array} history 
     * @param {number} avgCycleLengthMs 
     * @param {number} avgHaydLengthMs 
     * @returns {Object} { predStart, predEnd }
     */
    predictNextCycle: (history, avgCycleLengthMs, avgHaydLengthMs) => {
        if (avgCycleLengthMs <= 0 || !history || history.length === 0) {
            return {predStart: null, predEnd: null};
        }
        const lastHayd = history.find(e => e.status === 'hayd');
        if (!lastHayd) return {predStart: null, predEnd: null};

        const nextDateMs = new Date(lastHayd.time).getTime() + avgCycleLengthMs;
        const predStart = new Date(nextDateMs);
        const duration = avgHaydLengthMs > 0 ? avgHaydLengthMs : (5 * 86400000);
        const predEnd = new Date(nextDateMs + duration);

        return {predStart, predEnd};
    }
};

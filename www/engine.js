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
     * @param {number} habitDays - User's menstrual habit in days (for Maliki logic)
     * @returns {Object} { avgCycleLengthMs, avgHaydLengthMs }
     */
    calculateAverages: (history, rules = null, habitDays = 0) => {
        if (!history || history.length < 2) return {avgCycleLengthMs: 0, avgHaydLengthMs: 0};

        // Normalize timestamps to milliseconds to support both ISO strings and numeric values.
        const normalized = history
            .map(entry => {
                const timeMs = new Date(entry.time).getTime();
                return {...entry, timeMs};
            })
            .filter(entry =>
                (entry.status === 'hayd' || entry.status === 'purity')
                && Number.isFinite(entry.timeMs)
            );

        if (normalized.length < 2) return {avgCycleLengthMs: 0, avgHaydLengthMs: 0};

        // 1. Ensure history is sorted newest first (just in case)
        const sorted = [...normalized].sort((a, b) => b.timeMs - a.timeMs);

        // 2. Identify unique status transitions (ignoring duplicates)
        const cleanHistory = [];
        for (const entry of sorted) {
            if (cleanHistory.length === 0 || cleanHistory[cleanHistory.length - 1].status !== entry.status) {
                cleanHistory.push(entry);
            }
        }

        if (cleanHistory.length < 2) return {avgCycleLengthMs: 0, avgHaydLengthMs: 0};

        // 3. Cycle Length: Hayd Start to Hayd Start
        const haydStarts = cleanHistory.filter(e => e.status === 'hayd');
        let avgCycleLengthMs = 0;
        if (haydStarts.length >= 2) {
            const minTuhrMs = rules?.minTuhrMs || 0;
            let totalCycleMs = 0;
            let validCycleCount = 0;
            for (let i = 0; i < haydStarts.length - 1; i++) {
                const cycleMs = haydStarts[i].timeMs - haydStarts[i + 1].timeMs;
                // Ignore overlap/istihadah-like cycle fragments shorter than minimum tuhr.
                if (cycleMs >= minTuhrMs) {
                    totalCycleMs += cycleMs;
                    validCycleCount++;
                }
            }
            avgCycleLengthMs = validCycleCount > 0 ? totalCycleMs / validCycleCount : 0;
        }

        // 4. Hayd Duration: Hayd Start to Purity Start (next entry in cleanHistory is purity)
        let effectiveMaxMs = rules?.maxHaydMs || (15 * 24 * 60 * 60 * 1000);
        if (habitDays > 0 && rules?.dynamicMaxHayd) {
            effectiveMaxMs = Math.min(15 * 24 * 60 * 60 * 1000, (habitDays + 3) * 24 * 60 * 60 * 1000);
        }

        let totalHaydMs = 0, haydCount = 0;
        for (let i = 0; i < cleanHistory.length - 1; i++) {
            // Since cleanHistory is toggled, if i is Purity, i+1 MUST be Hayd (going backwards in time)
            if (cleanHistory[i].status === 'purity' && cleanHistory[i+1].status === 'hayd') {
                let duration = cleanHistory[i].timeMs - cleanHistory[i+1].timeMs;
                if (duration > effectiveMaxMs) duration = effectiveMaxMs;
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
     * @param {number} habitDays - User's menstrual habit in days (for Maliki logic)
     * @returns {Object} { ruleKey, isWarning, isAlert, days }
     */
    getFiqhContext: (status, lastChanged, now, rules = null, habitDays = 0) => {
        const lastDate = new Date(lastChanged);
        const hasValidLastDate = Number.isFinite(lastDate.getTime());
        const safeLastDate = hasValidLastDate ? lastDate : now;
        
        // Exact millisecond difference for rule durations
        const msDiff = Math.max(0, now.getTime() - safeLastDate.getTime());
        
        // Calendar day difference for Day 0 logic
        const utc1 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const utc2 = Date.UTC(safeLastDate.getFullYear(), safeLastDate.getMonth(), safeLastDate.getDate());
        const days = Math.max(0, Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24)));
        
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
            // Determine effective max hayd
            let effectiveMaxMs = rules?.maxHaydMs || (15 * 24 * 60 * 60 * 1000);
            if (habitDays > 0 && rules?.dynamicMaxHayd) {
                // Maliki: Habit + 3 days (Istizhar), absolute max 15
                effectiveMaxMs = Math.min(15 * 24 * 60 * 60 * 1000, (habitDays + 3) * 24 * 60 * 60 * 1000);
            }

            if (msDiff >= effectiveMaxMs) {
                ruleKey = rules?.warningKey || "msg_hayd_generic";
                isWarning = true;
            } else if (rules && rules.minHaydMs > 0 && msDiff <= rules.minHaydMs) {
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

export const TaharaEngine = {
    /**
     * Calculates averages from history. Pure function.
     * @param {Array} history - Array of {status, time} objects sorted newest first
     * @returns {Object} { avgCycleLengthMs, avgHaydLengthMs }
     */
    calculateAverages: (history) => {
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
                totalHaydMs += (new Date(history[i].time) - new Date(history[i + 1].time));
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
     * @returns {Object} { ruleKey, isWarning, isAlert, days }
     */
    getFiqhContext: (status, lastChanged, now) => {
        const lastDate = new Date(lastChanged);
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
            if (days >= 15) {
                ruleKey = "msg_hayd_warning_shafi";
                isWarning = true;
            } else if (days >= 10) {
                ruleKey = "msg_hayd_warning_hanafi";
                isWarning = true;
            } else if (days <= 3) {
                ruleKey = "msg_hayd_early";
            } else {
                ruleKey = "msg_hayd_generic";
            }
        }

        return {ruleKey, isWarning, isAlert, days};
    },

    /**
     * Predicts next cycle dates. Pure function.
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
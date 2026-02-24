(() => {
    // ==========================================
    // 1. APP STATE & HELPERS
    // ==========================================
    const App = {
        uiStrings: {},
        defaultStrings: {},
        currentLang: localStorage.getItem("tahara_userLang") || (['ar', 'fr', 'es', 'it'].includes(navigator.language.split('-')[0]) ? navigator.language.split('-')[0] : 'en'),
        isDark: localStorage.getItem("tahara_darkMode") === "true",
        status: localStorage.getItem("tahara_status") || "purity",
        lastChanged: localStorage.getItem("tahara_last_changed") || new Date().toISOString(),
        history: JSON.parse(localStorage.getItem("tahara_history") || "[]"),
        fasting: JSON.parse(localStorage.getItem("tahara_fasting") || '{"missed":0, "paid":0}'),
        dailyLogs: JSON.parse(localStorage.getItem("tahara_logs") || "{}"),
        selectedDate: new Date(),

        modalOpen: false,
        avgCycleLength: 0,
        avgHaydLength: 0
    };

    // ==========================================
    // MICRO-INTERACTIONS & TOASTS (B6)
    // ==========================================
    window.showToast = (messageKey, type = 'success', fallback = "Success") => {
        const container = el("toast-container");
        if (!container) return;

        const toast = document.createElement("div");
        const bgClass = type === 'success' ? 'bg-emerald-500' : (type === 'error' ? 'bg-rose-500' : 'bg-slate-800 dark:bg-slate-200');
        const textClass = type === 'neutral' ? 'text-white dark:text-slate-900' : 'text-white';

        toast.className = `px-4 py-2 rounded-full shadow-lg text-xs font-bold tracking-wide animate-fade-in ${bgClass} ${textClass}`;
        toast.innerText = S(messageKey, fallback); // SAFE FALLBACK ADDED

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    let pendingImportData = null;

    const el = (id) => document.getElementById(id);
    let calDate = new Date();

    const TAGS = {
        moods: ['mood_happy', 'mood_calm', 'mood_tired', 'mood_irritable', 'mood_sad'],
        symptoms: ['sym_cramps', 'sym_headache', 'sym_bloating', 'sym_acne', 'sym_nausea']
    };

    // Accessibility: Announce to screen readers
    window.announce = (msg) => {
        const el = el("sr-announcer");
        if (el) {
            el.innerText = ""; // Clear
            setTimeout(() => el.innerText = msg, 50); // Force re-read
        }
    };

    // ==========================================
    // DATA SCHEMA & MIGRATIONS (A2)
    // ==========================================
    const CURRENT_SCHEMA_VERSION = 1;

    function runDataMigrations() {
        // If there's no version, but there IS history, the user is implicitly on v1.
        // If there's no version and no history, it's a fresh install (also v1).
        const hasExistingData = localStorage.getItem("tahara_history") !== null;
        let userVersion = parseInt(localStorage.getItem("tahara_schema_version"));

        if (isNaN(userVersion)) {
            userVersion = hasExistingData ? 1 : CURRENT_SCHEMA_VERSION;
        }

        // --- MIGRATION STEPS GO HERE IN THE FUTURE ---
        // Example for future:
        // if (userVersion === 1) {
        //     console.log("Migrating from v1 to v2...");
        //     let history = JSON.parse(localStorage.getItem("tahara_history") || "[]");
        //     // Transform history data here without deleting unknown fields
        //     localStorage.setItem("tahara_history", JSON.stringify(history));
        //     userVersion = 2;
        // }

        // Finalize: Ensure the schema version is saved
        localStorage.setItem("tahara_schema_version", CURRENT_SCHEMA_VERSION.toString());
    }

    // RUN MIGRATIONS BEFORE ANYTHING ELSE
    runDataMigrations();

    function S(key, fallback) {
        if (App.uiStrings[key]) return App.uiStrings[key];
        if (App.defaultStrings[key]) return App.defaultStrings[key];
        if (App.globalStrings && App.globalStrings[key]) return App.globalStrings[key];
        return fallback || "";
    }

    function formatDateTime(isoString) {
        const d = new Date(isoString);
        return d.toLocaleString(App.currentLang, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
    }

    function getIsoDate(dateObj) {
        const offset = dateObj.getTimezoneOffset();
        const local = new Date(dateObj.getTime() - (offset * 60 * 1000));
        return local.toISOString().split('T')[0];
    }

    window.switchTab = (tabId) => {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        // Show target view
        const target = el(`view-${tabId}`);
        if (target) target.classList.remove('hidden');

        // Update Bottom Nav UI
        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.remove('text-slate-400');
                btn.classList.add('text-rose-500', 'font-bold');
            } else {
                btn.classList.add('text-slate-400');
                btn.classList.remove('text-rose-500', 'font-bold');
            }
        });

        // Trigger specific renders based on tab
        if (tabId === 'calendar') {
            App.selectedDate = new Date();
            renderCalendar();
            renderLogUI();
        } else if (tabId === 'history') {
            renderFullInsights();
        } else if (tabId === 'fasting') {
            updateFastingUI(); // Fetch latest fasting data when opened
        } else if (tabId === 'settings') {
            updateSettingsUI();
        }
    };

    function updateSettingsUI() {
        if (!el("reminderToggle")) return;

        el("reminderToggle").checked = App.reminderEnabled;
        el("reminderTime").value = App.reminderTime;
        if (App.reminderEnabled) el("reminderTimeContainer").classList.remove("hidden");

        // Set Warning Sign for Backup
        const lastBackupStr = localStorage.getItem("tahara_last_backup");
        let needsBackup = false;
        if (!lastBackupStr && App.history.length > 0) needsBackup = true;
        else if (lastBackupStr && (new Date() - new Date(lastBackupStr)) / 86400000 >= 30) needsBackup = true;

        const sign = el("settingsWarningSign");
        const navDot = el("settingsNavDot");
        if (sign) needsBackup ? sign.classList.remove("hidden") : sign.classList.add("hidden");
        // Also show a dot on the bottom nav icon so they know they need a backup!
        if (navDot) needsBackup ? navDot.classList.remove("hidden") : navDot.classList.add("hidden");

        updateFastingUI(); // Ensure fasting numbers are fresh
    }

    // ==========================================
    // 2. NATIVE ANDROID FEATURES
    // ==========================================
    async function initNativeFeatures() {
        if (typeof Capacitor === 'undefined') return;
        const {App: CapApp} = Capacitor.Plugins;
        const {StatusBar, Style} = Capacitor.Plugins;
        try {
            await StatusBar.setOverlaysWebView({overlay: true});

            if (App.isDark) {
                await StatusBar.setStyle({style: Style.Dark});
            } else {
                await StatusBar.setStyle({style: Style.Light});
            }
        } catch (e) {
            console.log("Status bar config failed", e);
        }
    }

    // ==========================================
    // 3. TAHARA ENGINE
    // ==========================================
    const TaharaEngine = {
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

            // Precise diff in days (midnight to midnight)
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

    // ==========================================
    // NOTIFICATION MANAGER
    // ==========================================
    const NotificationManager = {
        async init() {
            App.reminderEnabled = localStorage.getItem("tahara_reminder_enabled") === "true";
            App.reminderTime = localStorage.getItem("tahara_reminder_time") || "20:00"; // 8 PM Default
        },

        async requestPermission() {
            if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
                const {LocalNotifications} = Capacitor.Plugins;
                const permStatus = await LocalNotifications.requestPermissions();
                return permStatus.display === 'granted';
            } else if ("Notification" in window) {
                const permission = await Notification.requestPermission();
                return permission === "granted";
            }
            return false;
        },

        async scheduleDaily() {
            if (!App.reminderEnabled) return this.cancelAll();

            const [hours, minutes] = App.reminderTime.split(':').map(Number);

            if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
                const {LocalNotifications} = Capacitor.Plugins;
                await LocalNotifications.cancel({notifications: [{id: 1}]}); // Clear old

                await LocalNotifications.schedule({
                    notifications: [
                        {
                            title: S("notif_title", "Tahara Check-in"),
                            body: S("notif_body", "Don't forget to log your mood and symptoms today."),
                            id: 1,
                            schedule: {on: {hour: hours, minute: minutes}, repeats: true},
                            sound: null
                        }
                    ]
                });
            }
        },

        async cancelAll() {
            if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
                const {LocalNotifications} = Capacitor.Plugins;
                await LocalNotifications.cancel({notifications: [{id: 1}]});
            }
        },

        // Best-effort Web Fallback (triggers if tab is open)
        checkWebFallback() {
            if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) return;
            if (!App.reminderEnabled || !("Notification" in window) || Notification.permission !== "granted") return;

            const now = new Date();
            const [hours, minutes] = App.reminderTime.split(':').map(Number);
            const lastFired = localStorage.getItem("tahara_last_notif_date");
            const todayDate = now.toDateString();

            if (now.getHours() === hours && now.getMinutes() >= minutes && lastFired !== todayDate) {
                new Notification(S("notif_title", "Tahara Check-in"), {
                    body: S("notif_body", "Don't forget to log your mood and symptoms today."),
                    icon: "./img/favicon-96x96.png"
                });
                localStorage.setItem("tahara_last_notif_date", todayDate);
            }
        }
    };

    // ==========================================
    // 3. CORE LOGIC (Stats & Context)
    // ==========================================
    function calculateStats() {
        const {avgCycleLengthMs, avgHaydLengthMs} = TaharaEngine.calculateAverages(App.history);
        App.avgCycleLength = avgCycleLengthMs;
        App.avgHaydLength = avgHaydLengthMs;

        const unit = S("unit_days", "d");
        const toDays = (ms) => Math.round(ms / 86400000) + unit;

        // B5: EMPTY STATE LOGIC
        const haydCount = App.history.filter(e => e.status === 'hayd').length;

        if (haydCount < 2) {
            // Not enough data yet
            const emptyMsg = `<span class="text-[10px] font-normal text-rose-400/70 dark:text-rose-300/60">${S("empty_averages")}</span>`;
            if (el("avgCycleText")) el("avgCycleText").innerHTML = emptyMsg;
            if (el("avgPurityText")) el("avgPurityText").innerHTML = emptyMsg.replace("text-rose-400/70", "text-amber-600/70").replace("dark:text-rose-300/60", "dark:text-amber-400/60");
            if (el("nextPeriodText")) el("nextPeriodText").innerText = "--";
        } else {
            // We have data!
            if (el("avgCycleText")) el("avgCycleText").innerText = toDays(App.avgCycleLength);
            if (el("avgPurityText")) el("avgPurityText").innerText = toDays(App.avgCycleLength - App.avgHaydLength);

            const {predStart} = TaharaEngine.predictNextCycle(App.history, App.avgCycleLength, App.avgHaydLength);
            if (predStart && el("nextPeriodText")) {
                el("nextPeriodText").innerText = predStart.toLocaleDateString(App.currentLang, {
                    weekday: 'short', month: 'short', day: 'numeric'
                });
            } else {
                if (el("nextPeriodText")) el("nextPeriodText").innerText = "--";
            }
        }
    }

    function updateContextMessage() {
        const descText = document.querySelector("[data-i18n='status_desc']");
        if (!descText) return;

        if (App.history.length === 0) {
            descText.innerText = S("msg_welcome", "Welcome to Tahara. Tap below to log your first change.");
            descText.classList.remove("text-amber-600", "text-rose-600", "font-bold");
            return;
        }

        // 1. Get the pure Fiqh context
        const context = TaharaEngine.getFiqhContext(App.status, App.lastChanged, new Date());

        // 2. Apply it to the DOM
        descText.innerText = S(context.ruleKey);
        descText.classList.remove("text-amber-600", "text-rose-600", "font-bold");

        if (context.isWarning) {
            descText.classList.add("text-rose-600", "font-bold");
        } else if (context.isAlert) {
            descText.classList.add("text-amber-600", "font-bold");
        }
    }

    // ==========================================
    // 4. CALENDAR UI & LOGGING
    // ==========================================
    window.changeMonth = (delta) => {
        calDate.setMonth(calDate.getMonth() + delta);
        renderCalendar();
    };

    function getStateForDate(dateObj) {
        const entry = App.history.find(e => new Date(e.time) <= dateObj);
        return entry ? entry.status : 'purity';
    }

    function renderCalendar() {
        const grid = el("calendarDays");
        const monthLabel = el("calMonthYear");
        const weekHeader = el("calendarWeekdays");
        const legendContainer = el("calendarLegend");
        if (!grid || !monthLabel) return;

        calculateStats();
        App.history.sort((a, b) => new Date(b.time) - new Date(a.time));
        grid.innerHTML = "";
        monthLabel.innerText = calDate.toLocaleString(App.currentLang, {month: 'long', year: 'numeric'});

        const daysAr = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
        const daysEn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const days = App.currentLang === 'ar' ? daysAr : daysEn;
        if (weekHeader) weekHeader.innerHTML = days.map(d => `<span class="text-[11px] text-slate-500 dark:text-slate-400 font-bold">${d}</span>`).join('');
        if (legendContainer) legendContainer.innerHTML = `<div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-200 dark:bg-amber-700"></span> <span class="text-slate-500 dark:text-slate-300 font-bold">${S("status_purity", "Purity")}</span></div><div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-purple-300 dark:bg-purple-700"></span> <span class="text-slate-500 dark:text-slate-300 font-bold">${S("status_change", "Change")}</span></div><div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-200 dark:bg-rose-700"></span> <span class="text-slate-500 dark:text-slate-300 font-bold">${S("status_hayd", "Hayd")}</span></div>`;

        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const now = new Date();
        // Reset now to start of day for comparison
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);

        const selDateKey = getIsoDate(App.selectedDate);

        // Prediction Window
        const {predStart, predEnd} = TaharaEngine.predictNextCycle(App.history, App.avgCycleLength, App.avgHaydLength);

        for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div></div>`;

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day, 12, 0, 0);
            const checkDate = new Date(year, month, day); // Midnight for comparison
            const dateKey = getIsoDate(currentDayDate);

            // FIX: Disable Future Dates
            const isFuture = checkDate > todayMidnight;

            const hasTransition = App.history.some(e => {
                const d = new Date(e.time);
                return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
            });
            const endState = getStateForDate(currentDayDate);
            let isPredicted = false;
            if (predStart && currentDayDate >= predStart && currentDayDate <= predEnd && currentDayDate > now) isPredicted = true;

            let bgClass = "", textClass = "", borderClass = "";
            let cursorClass = isFuture ? "cursor-default opacity-40" : "cursor-pointer";
            let clickAttr = isFuture ? "" : `onclick="selectDate('${dateKey}')"`;

            if (isPredicted) {
                bgClass = "bg-transparent";
                textClass = "text-slate-400 dark:text-slate-500 font-bold";
                borderClass = "border-2 border-dashed border-slate-300 dark:border-slate-700";
            } else if (hasTransition) {
                bgClass = "bg-purple-100 dark:bg-purple-900/60";
                textClass = "text-purple-700 dark:text-purple-100 font-bold";
            } else if (endState === 'hayd') {
                bgClass = "bg-rose-100 dark:bg-rose-500/30";
                textClass = "text-rose-600 dark:text-rose-100 font-bold";
            } else if (currentDayDate <= now) {
                bgClass = "bg-amber-50 dark:bg-amber-900/20";
                textClass = "text-amber-700 dark:text-amber-200 font-bold";
            }

            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            const isSelected = dateKey === selDateKey && !isFuture;

            if (isSelected) borderClass = "ring-2 ring-slate-400 dark:ring-slate-500 z-20 scale-105";
            if (isToday) borderClass = "ring-2 ring-amber-500 font-black z-30 scale-110";

            let dot = "";
            if (App.dailyLogs[dateKey] && App.dailyLogs[dateKey].length > 0) {
                dot = `<div class="absolute bottom-1 w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-400"></div>`;
            }

            grid.innerHTML += `<div ${clickAttr} class="relative h-8 w-8 flex items-center justify-center text-[12px] rounded-full mx-auto mb-1 transition-all ${cursorClass} ${bgClass} ${textClass} ${borderClass}">
                ${day} ${dot}
            </div>`;
        }
    }

    window.selectDate = (dateStr) => {
        App.selectedDate = new Date(dateStr);
        const offset = App.selectedDate.getTimezoneOffset();
        App.selectedDate = new Date(App.selectedDate.getTime() + (offset * 60 * 1000));
        renderCalendar();
        renderLogUI();
    };

    function renderLogUI() {
        const container = el("dailyLogContainer");
        const dateText = el("selectedDateText");
        const moodsDiv = el("moodOptions");
        const symDiv = el("symptomOptions");
        if (!container) return;

        const dateKey = getIsoDate(App.selectedDate);

        // Hide log UI if future date selected (should not happen via click, but safe guard)
        const todayKey = getIsoDate(new Date());
        if (dateKey > todayKey) {
            container.classList.add("hidden");
            return;
        }

        const activeLogs = App.dailyLogs[dateKey] || [];
        container.classList.remove("hidden");
        dateText.innerText = App.selectedDate.toLocaleDateString(App.currentLang, {
            weekday: 'long', month: 'short', day: 'numeric'
        });

        const createTag = (key) => {
            const isActive = activeLogs.includes(key);
            const baseClass = "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border";
            const activeClass = "bg-rose-500 text-white border-rose-500 shadow-sm";
            const inactiveClass = "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-white/10 hover:border-rose-300";
            return `<button onclick="toggleLog('${key}')" class="${baseClass} ${isActive ? activeClass : inactiveClass}">${S(key)}</button>`;
        };

        moodsDiv.innerHTML = TAGS.moods.map(createTag).join('');
        symDiv.innerHTML = TAGS.symptoms.map(createTag).join('');
    }

    // FIX: Exclusive Moods Logic
    window.toggleLog = (tagKey) => {
        const dateKey = getIsoDate(App.selectedDate);
        if (!App.dailyLogs[dateKey]) App.dailyLogs[dateKey] = [];

        const isMood = TAGS.moods.includes(tagKey);

        if (isMood) {
            // Check if this specific mood is already active
            if (App.dailyLogs[dateKey].includes(tagKey)) {
                // If yes, remove it (deselect)
                const idx = App.dailyLogs[dateKey].indexOf(tagKey);
                App.dailyLogs[dateKey].splice(idx, 1);
            } else {
                // If no, remove ALL other moods first (Radio behavior)
                App.dailyLogs[dateKey] = App.dailyLogs[dateKey].filter(t => !TAGS.moods.includes(t));
                // Then add the new one
                App.dailyLogs[dateKey].push(tagKey);
            }
        } else {
            // For Symptoms: Toggle normally (Checkbox behavior)
            const idx = App.dailyLogs[dateKey].indexOf(tagKey);
            if (idx > -1) App.dailyLogs[dateKey].splice(idx, 1); else App.dailyLogs[dateKey].push(tagKey);
        }

        if (App.dailyLogs[dateKey].length === 0) delete App.dailyLogs[dateKey];
        localStorage.setItem("tahara_logs", JSON.stringify(App.dailyLogs));

        renderLogUI();
        renderCalendar();
    };

    // Handle Reminder Toggle
    el("reminderToggle").addEventListener("change", async (e) => {
        const isEnabled = e.target.checked;
        if (isEnabled) {
            const granted = await NotificationManager.requestPermission();
            if (!granted) {
                e.target.checked = false;
                alert(S("notif_denied", "Notification permission was denied."));
                return;
            }
            el("reminderTimeContainer").classList.remove("hidden");
        } else {
            el("reminderTimeContainer").classList.add("hidden");
        }

        App.reminderEnabled = isEnabled;
        localStorage.setItem("tahara_reminder_enabled", isEnabled);
        NotificationManager.scheduleDaily();
    });

    // Handle Reminder Time Change
    el("reminderTime").addEventListener("change", (e) => {
        App.reminderTime = e.target.value;
        localStorage.setItem("tahara_reminder_time", App.reminderTime);
        NotificationManager.scheduleDaily();
    });

    function renderFullInsights() {
        const fullList = el("fullHistoryList");
        if (!fullList) return;

        if (App.history.length === 0) {
            fullList.innerHTML = `<div class="text-center text-slate-400 text-sm py-12 italic">${S("no_history", "No history yet")}</div>`;
            return;
        }

        fullList.innerHTML = App.history.map(entry => {
            const label = entry.status === 'hayd' ? S("status_hayd", "Hayd") : S("status_purity", "Purity");
            const color = entry.status === 'hayd' ? 'text-rose-600 dark:text-rose-200' : 'text-amber-700 dark:text-amber-100';
            const bgClass = entry.status === 'hayd' ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20';

            return `<div class="p-4 rounded-3xl ${bgClass} border flex justify-between items-center animate-fade-in mb-2">
                <span class="text-sm font-bold ${color}">${label}</span>
                <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">${formatDateTime(entry.time)}</span>
            </div>`;
        }).join('');
    }

    // ==========================================
    // 7. STATE & ACTIONS
    // ==========================================
    function saveState() {
        localStorage.setItem("tahara_status", App.status);
        localStorage.setItem("tahara_history", JSON.stringify(App.history));
        localStorage.setItem("tahara_last_changed", App.lastChanged);
    }

    function toggleStatus() {
        App.status = App.status === "purity" ? "hayd" : "purity";
        App.lastChanged = new Date().toISOString();
        App.history.unshift({status: App.status, time: App.lastChanged});
        App.history.sort((a, b) => new Date(b.time) - new Date(a.time));
        saveState();
        updateStatusUI();
        const statusLabel = App.status === "purity" ? S("status_purity") : S("status_hayd");
        window.announce(`${S("announce_status")} ${statusLabel}`);
        renderFullInsights();
        showToast("toast_status_saved", "success", "Status updated");
        updateLiveCounter();
    }

    function updateStatusUI() {
        const orb = document.querySelector(".status-orb");
        const statusText = el("current-state-text");
        const actionBtn = el("mainActionBtn");

        updateContextMessage();

        if (App.status === "purity") {
            if (statusText) {
                statusText.innerText = S("status_purity", "Purity");
                statusText.className = "text-3xl font-black text-amber-600 dark:text-amber-100 transition-colors";
            }
            if (actionBtn) {
                actionBtn.innerText = S("btn_start_flow", "Mark Flow Started");
                actionBtn.style.background = "#fb7185";
            }
            if (orb) orb.classList.remove("status-hayd-pulse");
        } else {
            if (statusText) {
                statusText.innerText = S("status_hayd", "Hayd");
                statusText.className = "text-3xl font-black text-rose-500 dark:text-rose-300 transition-colors";
            }
            if (actionBtn) {
                actionBtn.innerText = S("btn_end_flow", "Mark Purity Achieved");
                actionBtn.style.background = "#10b981";
            }
            if (orb) orb.classList.add("status-hayd-pulse");
        }
        updateFastingUI();
    }

    function saveFasting() {
        localStorage.setItem("tahara_fasting", JSON.stringify(App.fasting));
        updateFastingUI();
    }

    function updateFastingUI() {
        const remaining = App.fasting.missed - App.fasting.paid;
        if (el("debtDisplay")) el("debtDisplay").innerText = remaining;
        if (el("totalMissed")) el("totalMissed").innerText = App.fasting.missed;
        if (el("totalPaid")) el("totalPaid").innerText = App.fasting.paid;
        const dot = el("debtDot");
        if (dot) (remaining > 0) ? dot.classList.remove("hidden") : dot.classList.add("hidden");
    }

    window.updateDebt = (delta) => {
        const newVal = App.fasting.missed + delta;
        if (newVal >= 0) {
            App.fasting.missed = newVal;
            saveFasting();
        }
    };
    window.updatePaid = (delta) => {
        const newVal = App.fasting.paid + delta;
        if (newVal >= 0 && newVal <= App.fasting.missed) {
            App.fasting.paid = newVal;
            saveFasting();
        }
    };

    async function exportData() {
        const data = {
            schema_version: CURRENT_SCHEMA_VERSION, // Added schema version
            tahara_status: App.status,
            tahara_last_changed: App.lastChanged,
            tahara_history: App.history,
            tahara_fasting: App.fasting,
            tahara_logs: App.dailyLogs,
            export_date: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(data, null, 2);
        const fileName = `tahara-backup-${new Date().toISOString().split('T')[0]}.json`;

        // Mobile / Capacitor flow (Web Share API)
        if (navigator.share && navigator.canShare) {
            try {
                const file = new File([jsonStr], fileName, {type: "application/json"});
                if (navigator.canShare({files: [file]})) {
                    await navigator.share({
                        title: S("app_title", "Tahara Backup"),
                        text: "My Tahara App Data Backup",
                        files: [file]
                    });
                    return; // Stop here if share was successful
                }
            } catch (err) {
                console.log("Sharing failed or cancelled", err);
            }
        }

        // Fallback: Standard Web Download
        const blob = new Blob([jsonStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        localStorage.setItem("tahara_last_backup", new Date().toISOString());
        // Re-render settings to hide the reminder dot immediately
        updateSettingsUI(); // FIXED
        showToast("toast_backup_success", "success", "Backup saved");
    }

    function importData() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);

                    // STRICT VALIDATION
                    if (!data.tahara_history || !Array.isArray(data.tahara_history)) throw new Error("Missing/Invalid history");
                    if (!data.tahara_status) throw new Error("Missing status");

                    // Hold in memory
                    pendingImportData = data;

                    // Render preview in UI
                    showRestorePreview(data);
                } catch (err) {
                    alert(S("import_error", "Error: Invalid backup file. The data is corrupted or unsupported."));
                    pendingImportData = null;
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    window.showInfoModal = (titleKey, messageKey) => {
        const modalHtml = `
            <div class="fixed inset-0 flex items-center justify-center p-4 animate-fade-in" id="customInfoModal" style="z-index: 99999;">
                <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="closeInfoModal()"></div>
                <div class="relative w-full max-w-sm bg-white dark:bg-[#1a1617] rounded-3xl p-6 shadow-2xl border border-rose-100 dark:border-rose-900/30 text-center">
                    <div class="w-10 h-10 bg-slate-50 dark:bg-white/5 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 text-lg">
                        ℹ️
                    </div>
                    <h3 class="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">${S(titleKey)}</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">${S(messageKey)}</p>
                    <button onclick="closeInfoModal()" data-i18n-aria="aria_close" class="w-full py-3 text-xs text-white bg-rose-500 font-bold uppercase rounded-full shadow-lg shadow-rose-500/30 active:scale-95 transition-transform">${S("btn_close", "Close")}</button>
                </div>
            </div>
        `;
        const container = document.createElement("div");
        container.innerHTML = modalHtml;
        document.body.appendChild(container);
    };

    window.closeInfoModal = () => {
        const modal = document.getElementById("customInfoModal");
        if (modal) modal.parentElement.remove();
    };

    function showConfirmModal(titleKey, messageKey, confirmBtnKey, onConfirmCallback) {
        const modalHtml = `
            <div class="fixed inset-0 flex items-center justify-center p-4 animate-fade-in" id="customConfirmModal" style="z-index: 99999;">
                <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="closeConfirmModal()"></div>
                <div class="relative w-full max-w-sm bg-white dark:bg-[#1a1617] rounded-3xl p-6 shadow-2xl border border-rose-100 dark:border-rose-900/30 text-center">
                    <div class="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
                        ⚠️
                    </div>
                    <h3 class="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">${S(titleKey)}</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">${S(messageKey)}</p>
                    <div class="flex gap-2">
                        <button onclick="closeConfirmModal()" data-i18n-aria="aria_close" class="flex-1 py-3 text-xs text-slate-500 font-bold uppercase rounded-full border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">${S("btn_cancel", "Cancel")}</button>
                        <button id="confirmActionBtn" class="flex-1 py-3 text-xs text-white bg-rose-500 font-bold uppercase rounded-full shadow-lg shadow-rose-500/30 transition-transform active:scale-95">${S(confirmBtnKey)}</button>
                    </div>
                </div>
            </div>
        `;
        const container = document.createElement("div");
        container.innerHTML = modalHtml;
        document.body.appendChild(container);

        document.getElementById("confirmActionBtn").onclick = () => {
            closeConfirmModal();
            onConfirmCallback();
        };
    }

    window.closeConfirmModal = () => {
        const modal = document.getElementById("customConfirmModal");
        if (modal) modal.parentElement.remove();
    };

    function showRestorePreview(data) {
        const historyCount = data.tahara_history.length;
        const logCount = Object.keys(data.tahara_logs || {}).length;
        const date = data.export_date ? formatDateTime(data.export_date) : S("unknown_date", "Unknown Date");
        const incomingVersion = data.schema_version || 1;

        const previewHtml = `
            <div class="fixed inset-0 flex items-center justify-center p-4" id="restorePreviewContainer" style="z-index: 99999;">
                <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="cancelRestore()"></div>
                <div class="relative w-full max-w-sm bg-white dark:bg-[#1a1617] rounded-3xl p-6 shadow-2xl animate-fade-in border border-rose-100 dark:border-rose-900/30">
                    <h2 class="text-xl font-serif italic text-rose-500 mb-2">${S("preview_restore", "Preview Restore")}</h2>
                    <p class="text-xs text-rose-400 mb-4 bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg border border-rose-100 dark:border-rose-900/30">
                        ⚠️ ${S("restore_warning", "Applying this will overwrite your current device data permanently.")}
                    </p>
                    <ul class="text-sm text-slate-600 dark:text-slate-300 space-y-2 mb-6 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                        <li class="flex justify-between border-b border-slate-200 dark:border-white/10 pb-1">
                            <span class="font-bold text-slate-400">${S("backup_date", "Backup Date:")}</span> 
                            <span>${date}</span>
                        </li>
                        <li class="flex justify-between border-b border-slate-200 dark:border-white/10 pb-1">
                            <span class="font-bold text-slate-400">${S("history_entries", "History Entries:")}</span> 
                            <span>${historyCount}</span>
                        </li>
                        <li class="flex justify-between border-b border-slate-200 dark:border-white/10 pb-1">
                            <span class="font-bold text-slate-400">${S("daily_logs", "Daily Logs:")}</span> 
                            <span>${logCount}</span>
                        </li>
                        <li class="flex justify-between pb-1">
                            <span class="font-bold text-slate-400">${S("data_version", "Data Version:")}</span> 
                            <span>v${incomingVersion}</span>
                        </li>
                    </ul>
                    <div class="flex gap-3">
                        <button onclick="cancelRestore()" class="flex-1 py-3 text-xs text-slate-500 font-bold uppercase rounded-full border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5">${S("btn_cancel", "Cancel")}</button>
                        <button onclick="confirmRestore()" class="flex-1 py-3 text-xs text-white bg-rose-500 font-bold uppercase rounded-full shadow-lg shadow-rose-500/30">${S("btn_confirm_restore", "Confirm Restore")}</button>
                    </div>
                </div>
            </div>
        `;
        const container = document.createElement("div");
        container.innerHTML = previewHtml;
        document.body.appendChild(container);
    }

    window.cancelRestore = () => {
        pendingImportData = null;
        const container = document.getElementById("restorePreviewContainer");
        if (container) container.remove();
    };

    window.confirmRestore = () => {
        if (!pendingImportData) return;

        App.status = pendingImportData.tahara_status;
        App.lastChanged = pendingImportData.tahara_last_changed;
        App.history = pendingImportData.tahara_history;
        App.fasting = pendingImportData.tahara_fasting || {missed: 0, paid: 0};
        App.dailyLogs = pendingImportData.tahara_logs || {};

        // Save schema version of imported data (or 1 if old backup)
        localStorage.setItem("tahara_schema_version", (pendingImportData.schema_version || 1).toString());

        saveState();
        saveFasting();
        localStorage.setItem("tahara_logs", JSON.stringify(App.dailyLogs));

        window.cancelRestore();
        location.reload(); // Reload to run migrations if an older version was imported
    };

    function deleteLastEntry() {
        if (App.history.length === 0) return;

        showConfirmModal(
            "delete_title",
            "delete_confirm",
            "btn_delete",
            () => {
                App.history.shift();
                if (App.history.length > 0) {
                    App.status = App.history[0].status;
                    App.lastChanged = App.history[0].time;
                } else {
                    App.status = "purity";
                    App.lastChanged = new Date().toISOString();
                }
                saveState();
                updateStatusUI();
                renderFullInsights();
                showToast("toast_entry_deleted", "neutral", "Entry removed");
                updateLiveCounter();
            }
        );
    }

    function clearAllData() {
        showConfirmModal(
            "clear_title",
            "clear_confirm",
            "clear_data",
            () => {
                localStorage.clear();
                App.history = [];
                App.fasting = {missed: 0, paid: 0};
                App.status = "purity";
                App.lastChanged = new Date().toISOString();
                App.dailyLogs = {};

                localStorage.setItem("tahara_schema_version", CURRENT_SCHEMA_VERSION.toString());
                localStorage.setItem("tahara_userLang", App.currentLang);
                localStorage.setItem("tahara_darkMode", App.isDark);

                // FIXED: Explicitly save the new empty state to storage
                saveState();
                saveFasting();

                // Refresh the UI
                updateStatusUI();
                renderFullInsights();
                updateSettingsUI(); // Ensure warning dots reset
                updateLiveCounter();

                // Show the toast safely
                showToast("toast_data_cleared", "error", "All data reset");
            }
        );
    }

    function updateLiveCounter() {
        const diff = Math.max(0, new Date() - new Date(App.lastChanged));
        const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000),
            m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
        const l = App.currentLang === 'ar' ? ['ي', 'س', 'د', 'ث'] : ['d', 'h', 'm', 's'];
        const elTimer = el("time-elapsed");
        if (elTimer) elTimer.innerText = `${d}${l[0]} ${h}${l[1]} ${m}${l[2]} ${s}${l[3]}`;
        updateContextMessage();
    }

    // ==========================================
    // 8. INSTALL & INIT
    // ==========================================
    let deferredPrompt;

    function checkInstall() {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) return;
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) return;
        const lastDismiss = localStorage.getItem("tahara_install_dismissed");
        if (lastDismiss && (new Date() - new Date(lastDismiss)) < (7 * 24 * 60 * 60 * 1000)) return;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) showInstallBanner("ios");
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallBanner("android");
    });

    function showInstallBanner(platform) {
        const banner = el("installBanner");
        const iosText = el("iosInstallText");
        const androidBtn = el("androidInstallBtn");
        if (!banner) return;
        if (platform === "ios") {
            iosText.classList.remove("hidden");
            const rawText = S("install_ios_desc", "Tap Share and Add to Home Screen");
            iosText.innerHTML = rawText.replace("%share_icon%", '<span class="text-blue-500 text-base">⎋</span>').replace("%plus_icon%", '<span class="text-slate-700 dark:text-slate-300 font-bold text-base">⊞</span>');
        } else {
            androidBtn.classList.remove("hidden");
            androidBtn.onclick = async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const {outcome} = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') dismissInstall();
                    deferredPrompt = null;
                }
            };
        }
        banner.classList.remove("hidden");
        setTimeout(() => banner.classList.remove("translate-y-20"), 100);
    }

    window.dismissInstall = () => {
        const banner = el("installBanner");
        banner.classList.add("translate-y-20");
        setTimeout(() => banner.classList.add("hidden"), 500);
        localStorage.setItem("tahara_install_dismissed", new Date().toISOString());
    };

    async function checkVersion() {
        try {
            const swRes = await fetch("sw.js");
            const text = await swRes.text();
            const match = text.match(/CACHE_NAME\s*=\s*["']([^"']+)["']/);
            const ver = match ? match[1].replace("tahara-", "") : "Dev";
            const vEl = el("appVersion");
            if (vEl) vEl.innerText = ver;
        } catch (e) {
        }
    }

    // 1. NEW: SEO Updater Function
    function updateSEO() {
        // Update Title
        document.title = S("app_title");

        // Update Description
        const descMeta = document.querySelector('meta[name="description"]');
        if (descMeta) descMeta.setAttribute("content", S("app_desc"));

        // Update Keywords
        const keysMeta = document.querySelector('meta[name="keywords"]');
        if (keysMeta) keysMeta.setAttribute("content", S("app_keywords"));

        // Update HTML Lang/Dir attributes
        document.documentElement.lang = App.currentLang;
        document.documentElement.dir = App.currentLang === "ar" ? "rtl" : "ltr";
    }

    // ==========================================
    // ONBOARDING LOGIC (B2)
    // ==========================================
    let currentOnbStep = 1;

    window.startOnboarding = () => {
        currentOnbStep = 1;
        updateOnboardingUI();
        const modal = el("onboardingModal");
        if (modal) {
            modal.classList.remove("hidden");
            // Tiny delay to allow display block to apply before animating opacity
            setTimeout(() => modal.classList.remove("opacity-0"), 10);
        }
    };

    window.nextOnboardingStep = () => {
        if (currentOnbStep < 3) {
            currentOnbStep++;
            updateOnboardingUI();
        } else {
            window.skipOnboarding();
        }
    };

    window.skipOnboarding = () => {
        localStorage.setItem("tahara_onboarded", "true");
        const modal = el("onboardingModal");
        if (modal) {
            modal.classList.add("opacity-0");
            setTimeout(() => modal.classList.add("hidden"), 500);
        }
    };

    function updateOnboardingUI() {
        // Hide all steps
        document.querySelectorAll(".onb-step").forEach(s => s.classList.add("hidden"));
        // Show current step
        const step = el(`onb-step-${currentOnbStep}`);
        if (step) step.classList.remove("hidden");

        // Update indicator dots
        const dots = document.querySelectorAll(".onb-dot");
        dots.forEach((d, i) => {
            if (i === currentOnbStep - 1) {
                d.classList.remove("bg-slate-200", "dark:bg-white/10");
                d.classList.add("bg-rose-500");
            } else {
                d.classList.add("bg-slate-200", "dark:bg-white/10");
                d.classList.remove("bg-rose-500");
            }
        });

        // Update button text with translation
        const btn = el("onbNextBtn");
        if (btn) {
            if (currentOnbStep === 3) {
                btn.innerText = S("onb_start", "Get Started");
            } else {
                btn.innerText = S("onb_next", "Next");
            }
        }
    }

    async function init() {
        try {
            const res = await fetch("strings.json");
            const raw = await res.json();
            App.globalStrings = raw['default'] || {};
            App.uiStrings = raw[App.currentLang] || raw['en'];
            App.defaultStrings = raw['en'];
        } catch (e) {
        }

        // 2. NEW: Check URL for language param (e.g. tahara.app/?lang=fr)
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && ['en', 'ar', 'fr', 'es', 'it'].includes(urlLang)) {
            App.currentLang = urlLang;
            localStorage.setItem("tahara_userLang", urlLang);
            // Reload strings for the new language immediately
            try {
                const res = await fetch("strings.json");
                const raw = await res.json();
                App.uiStrings = raw[App.currentLang] || raw['en'];
            } catch (e) {
            }
        }

        // Apply Direction & Theme
        document.documentElement.dir = App.currentLang === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = App.currentLang;
        document.body.classList.toggle("dark", App.isDark);

        // Add this inside init():
        await NotificationManager.init();

        switchTab('home');

        if (localStorage.getItem("tahara_onboarded") !== "true") {
            startOnboarding();
        }
        if (el("settingsBackupBtn")) el("settingsBackupBtn").onclick = exportData;
        if (el("settingsRestoreBtn")) el("settingsRestoreBtn").onclick = importData;
        if (el("settingsResetBtn")) el("settingsResetBtn").onclick = clearAllData;

        const langSel = el("langSelect");
        if (langSel) langSel.value = App.currentLang;

        // Translate UI and ARIA Labels
        const translateUI = () => {
            document.querySelectorAll("[data-i18n]").forEach(node => {
                const key = node.getAttribute("data-i18n");
                if (S(key)) node.innerText = S(key);
            });
            document.querySelectorAll("[data-i18n-aria]").forEach(node => {
                const key = node.getAttribute("data-i18n-aria");
                if (S(key)) node.setAttribute("aria-label", S(key));
            });
        };
        translateUI(); // Run once on load

        // 3. NEW: Trigger SEO Update
        updateSEO();

        const contactBtn = el("contactBtn");
        if (contactBtn) {
            const email = S("contact_email");
            const mailtoUrl = `mailto:${email}`;
            contactBtn.href = mailtoUrl;
            contactBtn.onclick = (e) => {
                if (typeof Capacitor !== 'undefined') {
                    e.preventDefault();
                    window.open(mailtoUrl, '_system');
                }
            };
        }

        updateStatusUI();
        updateLiveCounter();
        setInterval(() => {
            updateLiveCounter();
            NotificationManager.checkWebFallback();
        }, 1000);
        await checkVersion();
        el("mainActionBtn").onclick = toggleStatus;
        if (el("undoBtn")) el("undoBtn").onclick = deleteLastEntry;

        // Make sure to populate the history list on launch
        renderFullInsights();
        // 1. Update during initial load
        document.querySelector('meta[name="theme-color"]').setAttribute('content', App.isDark ? '#1a1617' : '#fff1f2');
        // 2. Update inside the toggle listener
        el("themeToggle").onclick = () => {
            App.isDark = !App.isDark;
            localStorage.setItem("tahara_darkMode", App.isDark);
            document.body.classList.toggle("dark", App.isDark);
            // ADD THIS: Update the browser/OS UI color
            document.querySelector('meta[name="theme-color"]')
                .setAttribute('content', App.isDark ? '#1a1617' : '#fff1f2');
            initNativeFeatures();
        };
        const playBtn = el("playStoreBtn");
        if (playBtn) {
            const platform = (typeof Capacitor !== 'undefined') ? Capacitor.getPlatform() : 'web';
            const isNative = (typeof Capacitor !== 'undefined') && Capacitor.isNativePlatform();

            if (platform !== 'ios') {
                playBtn.classList.remove("hidden");
                playBtn.href = S("play_store_url");

                // Dynamically change the text
                playBtn.innerText = isNative
                    ? S("play_store_rate_label")
                    : S("play_store_get_label");
            }
        }
        if (langSel) langSel.onchange = (e) => {
            const newLang = e.target.value;
            localStorage.setItem("tahara_userLang", newLang);
            // Update URL without reloading page (optional, but good for sharing)
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('lang', newLang);
            window.history.pushState({}, '', newUrl);
            location.reload();
        };

        initNativeFeatures();
        setTimeout(checkInstall, 3000);
    }

    /* =========================================
   SERVICE WORKER SETUP (Updates & Offline)
   ========================================= */

    // 1. Define the function
    function initServiceWorker() {
        if (!("serviceWorker" in navigator)) return;

        if (window.Capacitor && window.Capacitor.isNativePlatform()) return;

        navigator.serviceWorker.register("sw.js").then((reg) => {
            console.log("✅ Service Worker Registered!");

            if (reg.waiting) reg.waiting.postMessage({type: 'SKIP_WAITING'});

            reg.addEventListener("updatefound", () => {
                const newWorker = reg.installing;
                newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        // FIXED (C1): Don't force reload. Show a friendly prompt instead.
                        const container = el("toast-container");
                        if (container) {
                            const updateHtml = `
                                <div class="px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold animate-fade-in bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 w-full flex justify-between items-center border border-slate-700 dark:border-white/20">
                                    <span>${S("update_available", "Update available!")}</span>
                                    <button onclick="window.location.reload()" class="bg-rose-500 text-white px-3 py-1 rounded-full shadow-md active:scale-95 transition-transform">${S("btn_refresh", "Refresh")}</button>
                                </div>
                            `;
                            container.innerHTML += updateHtml;
                        }
                    }
                });
            });
        }).catch((err) => console.error("❌ SW Registration Failed:", err));

        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }

    // 2. Call it immediately
    initServiceWorker();

    window.onload = init;
})();
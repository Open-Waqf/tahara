import { TaharaEngine } from "./engine.js";

(() => {
    const App = {
        uiStrings: {},
        defaultStrings: {},
        currentLang: localStorage.getItem("tahara_userLang") || ([ "ar", "fr", "es", "it" ].includes(navigator.language.split("-")[0]) ? navigator.language.split("-")[0] : "en"),
        isDark: localStorage.getItem("tahara_darkMode") === "true",
        status: localStorage.getItem("tahara_status") || "purity",
        lastChanged: localStorage.getItem("tahara_last_changed") || (new Date).toISOString(),
        history: JSON.parse(localStorage.getItem("tahara_history") || "[]"),
        fasting: JSON.parse(localStorage.getItem("tahara_fasting") || '{"missed":0, "paid":0}'),
        dailyLogs: JSON.parse(localStorage.getItem("tahara_logs") || "{}"),
        selectedDate: new Date,
        modalOpen: false,
        avgCycleLength: 0,
        avgHaydLength: 0
    };
    window.safeDownloadJSON = async (dataObj, fileName) => {
        const jsonStr = JSON.stringify(dataObj, null, 2);
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            try {
                const {Filesystem: Filesystem, Share: Share} = Capacitor.Plugins;
                const writeResult = await Filesystem.writeFile({
                    path: fileName,
                    data: jsonStr,
                    directory: "CACHE",
                    encoding: "utf8"
                });
                await Share.share({
                    title: "Tahara Data",
                    url: writeResult.uri,
                    dialogTitle: "Save Tahara Data"
                });
                return true;
            } catch (err) {
                console.error("Native Capacitor export failed", err);
                return false;
            }
        }
        try {
            const blob = new Blob([ jsonStr ], {
                type: "application/json"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 150);
            return true;
        } catch (e) {
            console.error("Web export failed", e);
            return false;
        }
    };
    const ErrorLog = {
        logs: [],
        add(err) {
            const entry = {
                time: (new Date).toISOString(),
                message: err.message,
                stack: err.stack
            };
            this.logs.push(entry);
            if (this.logs.length > 20) this.logs.shift();
            console.error("Tahara Error Catch:", err);
        }
    };
    window.onerror = (msg, url, line, col, error) => {
        ErrorLog.add(error || {
            message: msg
        });
        return false;
    };
    window.safeDownloadJSON = async (dataObj, fileName) => {
        const jsonStr = JSON.stringify(dataObj, null, 2);
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            try {
                const {Filesystem: Filesystem, Share: Share} = Capacitor.Plugins;
                const writeResult = await Filesystem.writeFile({
                    path: fileName,
                    data: jsonStr,
                    directory: "CACHE",
                    encoding: "utf8"
                });
                await Share.share({
                    title: "Tahara Export",
                    url: writeResult.uri,
                    dialogTitle: "Save Tahara Data"
                });
                return true;
            } catch (err) {
                console.error("Native Capacitor export failed", err);
                return false;
            }
        }
        if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
            try {
                const file = new File([ jsonStr ], fileName, {
                    type: "text/plain"
                });
                if (navigator.canShare && navigator.canShare({
                    files: [ file ]
                })) {
                    await navigator.share({
                        files: [ file ]
                    });
                    return true;
                }
            } catch (err) {
                if (err.name === "AbortError") return false;
            }
        }
        try {
            const blob = new Blob([ jsonStr ], {
                type: "application/json"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 150);
            return true;
        } catch (e) {
            console.error("Web export failed", e);
            return false;
        }
    };
    window.exportDiagnostics = async () => {
        const diagnosticData = {
            app_version: el("appVersion")?.innerText || "Unknown",
            platform: navigator.userAgent,
            language: App.currentLang,
            error_history: ErrorLog.logs
        };
        const fileName = `tahara-diagnostics-${(new Date).toISOString().split("T")[0]}.json`;
        const success = await window.safeDownloadJSON(diagnosticData, fileName);
        if (success) showToast("toast_diagnostic_exported", "neutral", "Diagnostic log saved");
    };
    window.showToast = (messageKey, type = "success", fallback = "Success") => {
        const container = el("toast-container");
        if (!container) return;
        const toast = document.createElement("div");
        const bgClass = type === "success" ? "bg-emerald-500" : type === "error" ? "bg-rose-500" : "bg-slate-800 dark:bg-slate-200";
        const textClass = type === "neutral" ? "text-white dark:text-slate-900" : "text-white";
        toast.className = `px-4 py-2 rounded-full shadow-lg text-xs font-bold tracking-wide animate-fade-in ${bgClass} ${textClass}`;
        toast.innerText = S(messageKey, fallback);
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, 3e3);
    };
    let pendingImportData = null;
    const el = id => document.getElementById(id);
    let calDate = new Date;
    const TAGS = {
        moods: [ "mood_happy", "mood_calm", "mood_tired", "mood_irritable", "mood_sad" ],
        symptoms: [ "sym_cramps", "sym_headache", "sym_bloating", "sym_acne", "sym_nausea" ]
    };
    window.announce = msg => {
        const announcerNode = el("sr-announcer");
        if (announcerNode) {
            announcerNode.innerText = "";
            setTimeout(() => announcerNode.innerText = msg, 50);
        }
    };
    const CURRENT_SCHEMA_VERSION = 1;
    function runDataMigrations() {
        const hasExistingData = localStorage.getItem("tahara_history") !== null;
        let userVersion = parseInt(localStorage.getItem("tahara_schema_version"));
        if (isNaN(userVersion)) {
            userVersion = hasExistingData ? 1 : CURRENT_SCHEMA_VERSION;
        }
        localStorage.setItem("tahara_schema_version", CURRENT_SCHEMA_VERSION.toString());
    }
    runDataMigrations();
    function S(key, fallback) {
        if (App.uiStrings[key]) return App.uiStrings[key];
        if (App.defaultStrings[key]) return App.defaultStrings[key];
        if (App.globalStrings && App.globalStrings[key]) return App.globalStrings[key];
        return fallback || "";
    }
    function formatDateTime(isoString) {
        const d = new Date(isoString);
        return d.toLocaleString(App.currentLang, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }
    function getIsoDate(dateObj) {
        const offset = dateObj.getTimezoneOffset();
        const local = new Date(dateObj.getTime() - offset * 60 * 1e3);
        return local.toISOString().split("T")[0];
    }
    window.switchTab = tabId => {
        window.closeConfirmModal();
        window.closeInfoModal();
        document.querySelectorAll(".view-section").forEach(el => el.classList.add("hidden"));
        const target = el(`view-${tabId}`);
        if (target) target.classList.remove("hidden");
        document.querySelectorAll(".nav-btn").forEach(btn => {
            if (btn.getAttribute("data-tab") === tabId) {
                btn.classList.remove("text-slate-400");
                btn.classList.add("text-rose-500", "font-bold");
            } else {
                btn.classList.add("text-slate-400");
                btn.classList.remove("text-rose-500", "font-bold");
            }
        });
        if (tabId === "calendar") {
            App.selectedDate = new Date;
            renderCalendar();
            renderLogUI();
        } else if (tabId === "history") {
            renderFullInsights();
        } else if (tabId === "fasting") {
            updateFastingUI();
        } else if (tabId === "settings") {
            updateSettingsUI();
        }
    };
    function updateSettingsUI() {
        if (!el("reminderToggle")) return;
        el("reminderToggle").checked = App.reminderEnabled;
        el("reminderTime").value = App.reminderTime;
        if (App.reminderEnabled) el("reminderTimeContainer").classList.remove("hidden");
        const lastBackupStr = localStorage.getItem("tahara_last_backup");
        let needsBackup = false;
        if (!lastBackupStr && App.history.length > 0) needsBackup = true; else if (lastBackupStr && (new Date - new Date(lastBackupStr)) / 864e5 >= 30) needsBackup = true;
        const sign = el("settingsWarningSign");
        const navDot = el("settingsNavDot");
        if (sign) needsBackup ? sign.classList.remove("hidden") : sign.classList.add("hidden");
        if (navDot) needsBackup ? navDot.classList.remove("hidden") : navDot.classList.add("hidden");
        updateFastingUI();
    }
    async function initNativeFeatures() {
        if (typeof Capacitor === "undefined") return;
        const {App: CapApp} = Capacitor.Plugins;
        const {StatusBar: StatusBar, Style: Style} = Capacitor.Plugins;
        try {
            await StatusBar.setOverlaysWebView({
                overlay: true
            });
            if (App.isDark) {
                await StatusBar.setStyle({
                    style: Style.Dark
                });
            } else {
                await StatusBar.setStyle({
                    style: Style.Light
                });
            }
        } catch (e) {
            console.log("Status bar config failed", e);
        }
    }
    const NotificationManager = {
        async init() {
            App.reminderEnabled = localStorage.getItem("tahara_reminder_enabled") === "true";
            App.reminderTime = localStorage.getItem("tahara_reminder_time") || "20:00";
        },
        async requestPermission() {
            if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform()) {
                const {LocalNotifications: LocalNotifications} = Capacitor.Plugins;
                const permStatus = await LocalNotifications.requestPermissions();
                return permStatus.display === "granted";
            } else if ("Notification" in window) {
                const permission = await Notification.requestPermission();
                return permission === "granted";
            }
            return false;
        },
        async scheduleDaily() {
            if (!App.reminderEnabled) return this.cancelAll();
            const [hours, minutes] = App.reminderTime.split(":").map(Number);
            if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform()) {
                const {LocalNotifications: LocalNotifications} = Capacitor.Plugins;
                await LocalNotifications.cancel({
                    notifications: [ {
                        id: 1
                    } ]
                });
                await LocalNotifications.schedule({
                    notifications: [ {
                        title: S("notif_title", "Tahara Check-in"),
                        body: S("notif_body", "Don't forget to log your mood and symptoms today."),
                        id: 1,
                        schedule: {
                            on: {
                                hour: hours,
                                minute: minutes
                            },
                            repeats: true
                        },
                        sound: null
                    } ]
                });
            }
        },
        async cancelAll() {
            if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform()) {
                const {LocalNotifications: LocalNotifications} = Capacitor.Plugins;
                await LocalNotifications.cancel({
                    notifications: [ {
                        id: 1
                    } ]
                });
            }
        },
        checkWebFallback() {
            if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform()) return;
            if (!App.reminderEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
            const now = new Date;
            const [hours, minutes] = App.reminderTime.split(":").map(Number);
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
    function calculateStats() {
        const {avgCycleLengthMs: avgCycleLengthMs, avgHaydLengthMs: avgHaydLengthMs} = TaharaEngine.calculateAverages(App.history);
        App.avgCycleLength = avgCycleLengthMs;
        App.avgHaydLength = avgHaydLengthMs;
        const unit = S("unit_days", "d");
        const toDays = ms => Math.round(ms / 864e5) + unit;
        const haydCount = App.history.filter(e => e.status === "hayd").length;
        if (haydCount < 2) {
            const emptyMsg = `<span class="text-[10px] font-normal text-rose-400/70 dark:text-rose-300/60">${S("empty_averages")}</span>`;
            if (el("avgCycleText")) el("avgCycleText").innerHTML = emptyMsg;
            if (el("avgPurityText")) el("avgPurityText").innerHTML = emptyMsg.replace("text-rose-400/70", "text-amber-600/70").replace("dark:text-rose-300/60", "dark:text-amber-400/60");
            if (el("nextPeriodText")) el("nextPeriodText").innerText = "--";
        } else {
            if (el("avgCycleText")) el("avgCycleText").innerText = toDays(App.avgCycleLength);
            if (el("avgPurityText")) el("avgPurityText").innerText = toDays(App.avgCycleLength - App.avgHaydLength);
            const {predStart: predStart} = TaharaEngine.predictNextCycle(App.history, App.avgCycleLength, App.avgHaydLength);
            if (predStart && el("nextPeriodText")) {
                el("nextPeriodText").innerText = predStart.toLocaleDateString(App.currentLang, {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
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
        const context = TaharaEngine.getFiqhContext(App.status, App.lastChanged, new Date);
        descText.innerText = S(context.ruleKey);
        descText.classList.remove("text-amber-600", "text-rose-600", "font-bold");
        if (context.isWarning) {
            descText.classList.add("text-rose-600", "font-bold");
        } else if (context.isAlert) {
            descText.classList.add("text-amber-600", "font-bold");
        }
    }
    window.changeMonth = delta => {
        calDate.setMonth(calDate.getMonth() + delta);
        renderCalendar();
    };
    function getStateForDate(dateObj) {
        const entry = App.history.find(e => new Date(e.time) <= dateObj);
        return entry ? entry.status : "purity";
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
        monthLabel.innerText = calDate.toLocaleString(App.currentLang, {
            month: "long",
            year: "numeric"
        });
        const daysAr = [ "ح", "ن", "ث", "ر", "خ", "ج", "س" ];
        const daysEn = [ "S", "M", "T", "W", "T", "F", "S" ];
        const days = App.currentLang === "ar" ? daysAr : daysEn;
        if (weekHeader) weekHeader.innerHTML = days.map(d => `<span class="text-[11px] text-slate-500 dark:text-slate-400 font-bold">${d}</span>`).join("");
        if (legendContainer) legendContainer.innerHTML = `<div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-200 dark:bg-amber-700"></span> <span class="text-slate-500 dark:text-slate-300 font-bold">${S("status_purity", "Purity")}</span></div><div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-purple-300 dark:bg-purple-700"></span> <span class="text-slate-500 dark:text-slate-300 font-bold">${S("status_change", "Change")}</span></div><div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-200 dark:bg-rose-700"></span> <span class="text-slate-500 dark:text-slate-300 font-bold">${S("status_hayd", "Hayd")}</span></div>`;
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const now = new Date;
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);
        const selDateKey = getIsoDate(App.selectedDate);
        const {predStart: predStart, predEnd: predEnd} = TaharaEngine.predictNextCycle(App.history, App.avgCycleLength, App.avgHaydLength);
        for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div></div>`;
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day, 12, 0, 0);
            const checkDate = new Date(year, month, day);
            const dateKey = getIsoDate(currentDayDate);
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
            let clickAttr = isFuture ? "" : `data-date="${dateKey}"`;
            if (isPredicted) {
                bgClass = "bg-transparent";
                textClass = "text-slate-400 dark:text-slate-500 font-bold";
                borderClass = "border-2 border-dashed border-slate-300 dark:border-slate-700";
            } else if (hasTransition) {
                bgClass = "bg-purple-100 dark:bg-purple-900/60";
                textClass = "text-purple-700 dark:text-purple-100 font-bold";
            } else if (endState === "hayd") {
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
            grid.innerHTML += `<div ${clickAttr} class="relative h-8 w-8 flex items-center justify-center text-[12px] rounded-full mx-auto mb-1 transition-all ${cursorClass} ${bgClass} ${textClass} ${borderClass}">\n                ${day} ${dot}\n            </div>`;
        }
    }
    window.selectDate = dateStr => {
        App.selectedDate = new Date(dateStr);
        const offset = App.selectedDate.getTimezoneOffset();
        App.selectedDate = new Date(App.selectedDate.getTime() + offset * 60 * 1e3);
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
        const todayKey = getIsoDate(new Date);
        if (dateKey > todayKey) {
            container.classList.add("hidden");
            return;
        }
        const activeLogs = App.dailyLogs[dateKey] || [];
        container.classList.remove("hidden");
        dateText.innerText = App.selectedDate.toLocaleDateString(App.currentLang, {
            weekday: "long",
            month: "short",
            day: "numeric"
        });
        const createTag = key => {
            const isActive = activeLogs.includes(key);
            const baseClass = "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border";
            const activeClass = "bg-rose-500 text-white border-rose-500 shadow-sm";
            const inactiveClass = "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-white/10 hover:border-rose-300";
            return `<button data-log="${key}" class="${baseClass} ${isActive ? activeClass : inactiveClass}">${S(key)}</button>`;
        };
        moodsDiv.innerHTML = TAGS.moods.map(createTag).join("");
        symDiv.innerHTML = TAGS.symptoms.map(createTag).join("");
    }
    window.toggleLog = tagKey => {
        const dateKey = getIsoDate(App.selectedDate);
        if (!App.dailyLogs[dateKey]) App.dailyLogs[dateKey] = [];
        const isMood = TAGS.moods.includes(tagKey);
        if (isMood) {
            if (App.dailyLogs[dateKey].includes(tagKey)) {
                const idx = App.dailyLogs[dateKey].indexOf(tagKey);
                App.dailyLogs[dateKey].splice(idx, 1);
            } else {
                App.dailyLogs[dateKey] = App.dailyLogs[dateKey].filter(t => !TAGS.moods.includes(t));
                App.dailyLogs[dateKey].push(tagKey);
            }
        } else {
            const idx = App.dailyLogs[dateKey].indexOf(tagKey);
            if (idx > -1) App.dailyLogs[dateKey].splice(idx, 1); else App.dailyLogs[dateKey].push(tagKey);
        }
        if (App.dailyLogs[dateKey].length === 0) delete App.dailyLogs[dateKey];
        localStorage.setItem("tahara_logs", JSON.stringify(App.dailyLogs));
        renderLogUI();
        renderCalendar();
    };
    el("reminderToggle").addEventListener("change", async e => {
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
    el("reminderTime").addEventListener("change", e => {
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
        fullList.innerHTML = App.history.map((entry, index) => {
            const label = entry.status === "hayd" ? S("status_hayd", "Hayd") : S("status_purity", "Purity");
            const color = entry.status === "hayd" ? "text-rose-600 dark:text-rose-200" : "text-amber-700 dark:text-amber-100";
            const bgClass = entry.status === "hayd" ? "bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20" : "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20";
            return `\n            <div class="p-4 rounded-3xl ${bgClass} border flex justify-between items-center animate-fade-in mb-2 group">\n                <div class="flex flex-col">\n                    <span class="text-sm font-bold ${color}">${label}</span>\n                    <span class="text-[10px] text-slate-400 font-medium">${formatDateTime(entry.time)}</span>\n                </div>\n                <button data-delete-index="${index}" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/40 text-slate-300 hover:text-rose-500 transition-all">\n                    <span class="text-lg">🗑️</span>\n                </button>\n            </div>`;
        }).join("");
    }
    function deleteSpecificEntry(index) {
        showConfirmModal("delete_title", "delete_confirm", "btn_delete", () => {
            App.history.splice(index, 1);
            if (index === 0) {
                if (App.history.length > 0) {
                    App.status = App.history[0].status;
                    App.lastChanged = App.history[0].time;
                } else {
                    App.status = "purity";
                    App.lastChanged = (new Date).toISOString();
                }
            }
            saveState();
            updateStatusUI();
            renderFullInsights();
            updateLiveCounter();
            showToast("toast_entry_deleted", "neutral", "Entry removed");
        });
    }
    function saveState() {
        localStorage.setItem("tahara_status", App.status);
        localStorage.setItem("tahara_history", JSON.stringify(App.history));
        localStorage.setItem("tahara_last_changed", App.lastChanged);
    }
    function toggleStatus() {
        App.status = App.status === "purity" ? "hayd" : "purity";
        App.lastChanged = (new Date).toISOString();
        App.history.unshift({
            status: App.status,
            time: App.lastChanged
        });
        App.history.sort((a, b) => new Date(b.time) - new Date(a.time));
        saveState();
        updateStatusUI();
        const statusLabel = App.status === "purity" ? S("status_purity") : S("status_hayd");
        window.announce(`${S("announce_status")} ${statusLabel}`);
        renderFullInsights();
        showToast("toast_status_saved", "success", "Status updated");
        updateLiveCounter();
        const historyTabBtn = document.querySelector('[data-tab="history"]');
        if (historyTabBtn) {
            historyTabBtn.classList.add("animate-bounce", "text-rose-500");
            setTimeout(() => {
                historyTabBtn.classList.remove("animate-bounce");
                const isHistoryVisible = !el("view-history").classList.contains("hidden");
                if (!isHistoryVisible) {
                    historyTabBtn.classList.remove("text-rose-500");
                }
            }, 1e3);
        }
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
        const lastLogContainer = el("last-logged-info");
        const lastLogTime = el("last-logged-time");
        if (lastLogContainer && lastLogTime) {
            if (App.history.length > 0) {
                lastLogContainer.classList.remove("hidden");
                lastLogTime.innerText = formatDateTime(App.history[0].time);
            } else {
                lastLogContainer.classList.add("hidden");
            }
        }
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
        if (dot) remaining > 0 ? dot.classList.remove("hidden") : dot.classList.add("hidden");
    }
    window.updateDebt = delta => {
        const newVal = App.fasting.missed + delta;
        if (newVal >= 0) {
            App.fasting.missed = newVal;
            saveFasting();
        }
    };
    window.updatePaid = delta => {
        const newVal = App.fasting.paid + delta;
        if (newVal >= 0 && newVal <= App.fasting.missed) {
            App.fasting.paid = newVal;
            saveFasting();
        }
    };
    async function exportData() {
        const data = {
            schema_version: CURRENT_SCHEMA_VERSION,
            tahara_status: App.status,
            tahara_last_changed: App.lastChanged,
            tahara_history: App.history,
            tahara_fasting: App.fasting,
            tahara_logs: App.dailyLogs,
            export_date: (new Date).toISOString()
        };
        const fileName = `tahara-backup-${(new Date).toISOString().split("T")[0]}.json`;
        const success = await window.safeDownloadJSON(data, fileName);
        if (success) {
            localStorage.setItem("tahara_last_backup", (new Date).toISOString());
            updateSettingsUI();
            showToast("toast_backup_success", "success", "Backup saved");
        }
    }
    function importData() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "*/*";
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader;
            reader.onload = event => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (!data.tahara_history || !Array.isArray(data.tahara_history)) throw new Error("Missing/Invalid history");
                    if (!data.tahara_status) throw new Error("Missing status");
                    pendingImportData = data;
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
        const modalHtml = `\n            <div class="fixed inset-0 flex items-center justify-center p-4 animate-fade-in" id="customInfoModal" style="z-index: 99999;">\n                <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm modal-backdrop"></div>\n                <div class="relative w-full max-w-sm bg-white dark:bg-[#1a1617] rounded-3xl p-6 shadow-2xl border border-rose-100 dark:border-rose-900/30 text-center">\n                    <div class="w-10 h-10 bg-slate-50 dark:bg-white/5 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 text-lg">ℹ️</div>\n                    <h3 class="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">${S(titleKey)}</h3>\n                    <p class="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">${S(messageKey)}</p>\n                    <button data-i18n-aria="aria_close" class="modal-close-btn w-full py-3 text-xs text-white bg-rose-500 font-bold uppercase rounded-full shadow-lg shadow-rose-500/30 active:scale-95 transition-transform">${S("btn_close", "Close")}</button>\n                </div>\n            </div>\n        `;
        const container = document.createElement("div");
        container.innerHTML = modalHtml;
        document.body.appendChild(container);
        container.querySelector(".modal-backdrop").addEventListener("click", window.closeInfoModal);
        container.querySelector(".modal-close-btn").addEventListener("click", window.closeInfoModal);
    };
    window.closeInfoModal = () => {
        const modal = document.getElementById("customInfoModal");
        if (modal) modal.parentElement.remove();
    };
    function showConfirmModal(titleKey, messageKey, confirmBtnKey, onConfirmCallback) {
        if (el("customConfirmModal")) return;
        const modalHtml = `\n            <div class="fixed inset-0 flex items-center justify-center p-4 animate-fade-in" id="customConfirmModal" style="z-index: 99999;">\n                <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm modal-backdrop"></div>\n                <div class="relative w-full max-w-sm bg-white dark:bg-[#1a1617] rounded-3xl p-6 shadow-2xl border border-rose-100 dark:border-rose-900/30 text-center">\n                    <div class="w-12 h-12 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">⚠️</div>\n                    <h3 class="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">${S(titleKey)}</h3>\n                    <p class="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">${S(messageKey)}</p>\n                    <div class="flex gap-2">\n                        <button data-i18n-aria="aria_close" class="modal-cancel-btn flex-1 py-3 text-xs text-slate-500 font-bold uppercase rounded-full border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">${S("btn_cancel", "Cancel")}</button>\n                        <button class="modal-confirm-btn flex-1 py-3 text-xs text-white bg-rose-500 font-bold uppercase rounded-full shadow-lg shadow-rose-500/30 transition-transform active:scale-95">${S(confirmBtnKey)}</button>\n                    </div>\n                </div>\n            </div>\n        `;
        const container = document.createElement("div");
        container.innerHTML = modalHtml;
        document.body.appendChild(container);
        container.querySelector(".modal-backdrop").addEventListener("click", window.closeConfirmModal);
        container.querySelector(".modal-cancel-btn").addEventListener("click", window.closeConfirmModal);
        container.querySelector(".modal-confirm-btn").addEventListener("click", () => {
            window.closeConfirmModal();
            onConfirmCallback();
        });
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
        const previewHtml = `\n            <div class="fixed inset-0 flex items-center justify-center p-4" id="restorePreviewContainer" style="z-index: 99999;">\n                <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm modal-backdrop"></div>\n                <div class="relative w-full max-w-sm bg-white dark:bg-[#1a1617] rounded-3xl p-6 shadow-2xl animate-fade-in border border-rose-100 dark:border-rose-900/30">\n                    <h2 class="text-xl font-serif italic text-rose-500 mb-2">${S("preview_restore", "Preview Restore")}</h2>\n                    <p class="text-xs text-rose-400 mb-4 bg-rose-50 dark:bg-rose-900/20 p-2 rounded-lg border border-rose-100 dark:border-rose-900/30">\n                        ⚠️ ${S("restore_warning", "Applying this will overwrite your current device data permanently.")}\n                    </p>\n                    <ul class="text-sm text-slate-600 dark:text-slate-300 space-y-2 mb-6 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">\n                        <li class="flex justify-between border-b border-slate-200 dark:border-white/10 pb-1">\n                            <span class="font-bold text-slate-400">${S("backup_date", "Backup Date:")}</span> \n                            <span>${date}</span>\n                        </li>\n                        <li class="flex justify-between border-b border-slate-200 dark:border-white/10 pb-1">\n                            <span class="font-bold text-slate-400">${S("history_entries", "History Entries:")}</span> \n                            <span>${historyCount}</span>\n                        </li>\n                        <li class="flex justify-between border-b border-slate-200 dark:border-white/10 pb-1">\n                            <span class="font-bold text-slate-400">${S("daily_logs", "Daily Logs:")}</span> \n                            <span>${logCount}</span>\n                        </li>\n                        <li class="flex justify-between pb-1">\n                            <span class="font-bold text-slate-400">${S("data_version", "Data Version:")}</span> \n                            <span>v${incomingVersion}</span>\n                        </li>\n                    </ul>\n                    <div class="flex gap-3">\n                        <button class="modal-cancel-btn flex-1 py-3 text-xs text-slate-500 font-bold uppercase rounded-full border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5">${S("btn_cancel", "Cancel")}</button>\n                        <button class="modal-confirm-btn flex-1 py-3 text-xs text-white bg-rose-500 font-bold uppercase rounded-full shadow-lg shadow-rose-500/30">${S("btn_confirm_restore", "Confirm Restore")}</button>\n                    </div>\n                </div>\n            </div>\n        `;
        const container = document.createElement("div");
        container.innerHTML = previewHtml;
        document.body.appendChild(container);
        container.querySelector(".modal-backdrop").addEventListener("click", window.cancelRestore);
        container.querySelector(".modal-cancel-btn").addEventListener("click", window.cancelRestore);
        container.querySelector(".modal-confirm-btn").addEventListener("click", window.confirmRestore);
    }
    window.cancelRestore = () => {
        pendingImportData = null;
        const container = document.getElementById("restorePreviewContainer");
        if (container) container.remove();
    };
    window.confirmRestore = () => {
        if (!pendingImportData) return;
        const d = pendingImportData;
        const isValidStatus = [ "purity", "hayd" ].includes(d.tahara_status);
        const hasHistory = Array.isArray(d.tahara_history);
        if (!isValidStatus || !hasHistory) {
            showToast("import_error", "error", "Invalid data format");
            window.cancelRestore();
            return;
        }
        App.status = pendingImportData.tahara_status;
        App.lastChanged = pendingImportData.tahara_last_changed;
        App.history = pendingImportData.tahara_history;
        App.fasting = pendingImportData.tahara_fasting || {
            missed: 0,
            paid: 0
        };
        App.dailyLogs = pendingImportData.tahara_logs || {};
        localStorage.setItem("tahara_schema_version", (pendingImportData.schema_version || 1).toString());
        saveState();
        saveFasting();
        localStorage.setItem("tahara_logs", JSON.stringify(App.dailyLogs));
        window.cancelRestore();
        location.reload();
    };
    function deleteLastEntry() {
        if (App.history.length === 0) return;
        showConfirmModal("delete_title", "delete_confirm", "btn_delete", () => {
            App.history.shift();
            if (App.history.length > 0) {
                App.status = App.history[0].status;
                App.lastChanged = App.history[0].time;
            } else {
                App.status = "purity";
                App.lastChanged = (new Date).toISOString();
            }
            saveState();
            updateStatusUI();
            renderFullInsights();
            showToast("toast_entry_deleted", "neutral", "Entry removed");
            updateLiveCounter();
        });
    }
    function clearAllData() {
        showConfirmModal("clear_title", "clear_confirm", "clear_data", () => {
            localStorage.clear();
            App.history = [];
            App.fasting = {
                missed: 0,
                paid: 0
            };
            App.status = "purity";
            App.lastChanged = (new Date).toISOString();
            App.dailyLogs = {};
            localStorage.setItem("tahara_schema_version", CURRENT_SCHEMA_VERSION.toString());
            localStorage.setItem("tahara_userLang", App.currentLang);
            localStorage.setItem("tahara_darkMode", App.isDark);
            saveState();
            saveFasting();
            updateStatusUI();
            renderFullInsights();
            updateSettingsUI();
            updateLiveCounter();
            showToast("toast_data_cleared", "error", "All data reset");
        });
    }
    function updateLiveCounter() {
        const diff = Math.max(0, new Date - new Date(App.lastChanged));
        const d = Math.floor(diff / 864e5), h = Math.floor(diff % 864e5 / 36e5), m = Math.floor(diff % 36e5 / 6e4), s = Math.floor(diff % 6e4 / 1e3);
        const l = App.currentLang === "ar" ? [ "ي", "س", "د", "ث" ] : [ "d", "h", "m", "s" ];
        const elTimer = el("time-elapsed");
        if (elTimer) elTimer.innerText = `${d}${l[0]} ${h}${l[1]} ${m}${l[2]} ${s}${l[3]}`;
        updateContextMessage();
    }
    let deferredPrompt;
    function checkInstall() {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) return;
        if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) return;
        const lastDismiss = localStorage.getItem("tahara_install_dismissed");
        if (lastDismiss && new Date - new Date(lastDismiss) < 7 * 24 * 60 * 60 * 1e3) return;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) showInstallBanner("ios");
    }
    window.addEventListener("beforeinstallprompt", e => {
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
                    const {outcome: outcome} = await deferredPrompt.userChoice;
                    if (outcome === "accepted") dismissInstall();
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
        localStorage.setItem("tahara_install_dismissed", (new Date).toISOString());
    };
    async function checkVersion() {
        try {
            const swRes = await fetch("sw.js");
            const text = await swRes.text();
            const match = text.match(/CACHE_NAME\s*=\s*["']([^"']+)["']/);
            const ver = match ? match[1].replace("tahara-", "") : "Dev";
            const vEl = el("appVersion");
            if (vEl) vEl.innerText = ver;
        } catch (e) {}
    }
    function updateSEO() {
        document.title = S("app_title", "Tahara");
        const descMeta = document.querySelector('meta[name="description"]');
        if (descMeta) descMeta.setAttribute("content", S("app_desc", "A private, offline-first Islamic Purity tracker."));
        const keysMeta = document.querySelector('meta[name="keywords"]');
        if (keysMeta) keysMeta.setAttribute("content", S("app_keywords", "Tahara, Islamic Purity, Salah Tracker"));
        document.documentElement.lang = App.currentLang;
        document.documentElement.dir = App.currentLang === "ar" ? "rtl" : "ltr";
        const canonicalUrl = el("canonicalUrl");
        if (canonicalUrl) {
            const baseUrl = "https://tahara.open-waqf.org/";
            canonicalUrl.href = App.currentLang === "en" ? baseUrl : `${baseUrl}?lang=${App.currentLang}`;
        }
        let ldJson = el("structured-data-script");
        if (!ldJson) {
            ldJson = document.createElement("script");
            ldJson.type = "application/ld+json";
            ldJson.id = "structured-data-script";
            document.head.appendChild(ldJson);
        }
        ldJson.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: S("app_title", "Tahara"),
            applicationCategory: "HealthApplication",
            operatingSystem: "Android, iOS, Web",
            offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD"
            },
            description: S("app_desc", "A private, offline-first Islamic Purity tracker."),
            author: {
                "@type": "Organization",
                name: "Open Waqf"
            }
        });
    }
    let currentOnbStep = 1;
    window.startOnboarding = () => {
        currentOnbStep = 1;
        updateOnboardingUI();
        const modal = el("onboardingModal");
        if (modal) {
            modal.classList.remove("hidden");
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
        document.querySelectorAll(".onb-step").forEach(s => s.classList.add("hidden"));
        const step = el(`onb-step-${currentOnbStep}`);
        if (step) step.classList.remove("hidden");
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
            App.globalStrings = raw["default"] || {};
            const urlParams = new URLSearchParams(window.location.search);
            const urlLang = urlParams.get("lang");
            if (urlLang && [ "en", "ar", "fr", "es", "it" ].includes(urlLang)) {
                App.currentLang = urlLang;
                localStorage.setItem("tahara_userLang", urlLang);
            }
            App.uiStrings = raw[App.currentLang] || raw["en"];
            App.defaultStrings = raw["en"];
        } catch (e) {
            console.error("Failed to load strings", e);
        } finally {
            requestAnimationFrame(() => {
                document.documentElement.style.opacity = "1";
            });
        }
        document.documentElement.dir = App.currentLang === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = App.currentLang;
        document.body.classList.toggle("dark", App.isDark);
        document.querySelector('meta[name="theme-color"]').setAttribute("content", App.isDark ? "#1a1617" : "#fff1f2");
        const langSel = el("langSelect");
        if (langSel) langSel.value = App.currentLang;
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
        translateUI();
        initServiceWorker();
        switchTab("home");
        updateStatusUI();
        updateLiveCounter();
        const bindClick = (id, fn) => {
            const e = el(id);
            if (e) e.addEventListener("click", fn);
        };
        bindClick("mainActionBtn", toggleStatus);
        bindClick("undoBtn", deleteLastEntry);
        bindClick("themeToggle", () => {
            App.isDark = !App.isDark;
            localStorage.setItem("tahara_darkMode", App.isDark);
            document.body.classList.toggle("dark", App.isDark);
            document.querySelector('meta[name="theme-color"]').setAttribute("content", App.isDark ? "#1a1617" : "#fff1f2");
            initNativeFeatures();
        });
        document.querySelectorAll(".nav-btn").forEach(btn => {
            btn.addEventListener("click", e => {
                const target = e.currentTarget.getAttribute("data-target");
                if (target) switchTab(target);
            });
        });
        bindClick("btnMissedAdd", () => updateDebt(1));
        bindClick("btnMissedSub", () => updateDebt(-1));
        bindClick("btnPaidAdd", () => updatePaid(1));
        bindClick("btnPaidSub", () => updatePaid(-1));
        bindClick("btnPrevMonth", () => changeMonth(-1));
        bindClick("btnNextMonth", () => changeMonth(1));
        bindClick("btnInfoCycle", () => showInfoModal("avg_cycle", "explainer_cycle"));
        bindClick("btnInfoPurity", () => showInfoModal("avg_purity", "explainer_purity"));
        bindClick("btnDismissInstall", dismissInstall);
        bindClick("btnSkipOnboarding", skipOnboarding);
        bindClick("onbNextBtn", nextOnboardingStep);
        bindClick("btnReplayOnboarding", startOnboarding);
        if (el("calendarDays")) {
            el("calendarDays").addEventListener("click", e => {
                const dayEl = e.target.closest("[data-date]");
                if (dayEl) selectDate(dayEl.getAttribute("data-date"));
            });
        }
        if (el("fullHistoryList")) {
            el("fullHistoryList").addEventListener("click", e => {
                const btn = e.target.closest("[data-delete-index]");
                if (btn) {
                    const index = parseInt(btn.getAttribute("data-delete-index"));
                    deleteSpecificEntry(index);
                }
            });
        }
        const handleLogClick = e => {
            const btn = e.target.closest("[data-log]");
            if (btn) toggleLog(btn.getAttribute("data-log"));
        };
        if (el("moodOptions")) el("moodOptions").addEventListener("click", handleLogClick);
        if (el("symptomOptions")) el("symptomOptions").addEventListener("click", handleLogClick);
        if (langSel) langSel.onchange = e => {
            const newLang = e.target.value;
            localStorage.setItem("tahara_userLang", newLang);
            const newUrl = new URL(window.location);
            newUrl.searchParams.set("lang", newLang);
            window.history.pushState({}, "", newUrl);
            location.reload();
        };
        setTimeout(async () => {
            if (localStorage.getItem("tahara_onboarded") !== "true") {
                startOnboarding();
            }
            if (el("settingsBackupBtn")) el("settingsBackupBtn").onclick = exportData;
            if (el("settingsRestoreBtn")) el("settingsRestoreBtn").onclick = importData;
            if (el("settingsResetBtn")) el("settingsResetBtn").onclick = clearAllData;
            if (el("settingsDiagnosticBtn")) el("settingsDiagnosticBtn").onclick = exportDiagnostics;
            const contactBtn = el("contactBtn");
            if (contactBtn) {
                const mailtoUrl = `mailto:${S("contact_email")}`;
                contactBtn.href = mailtoUrl;
                contactBtn.onclick = e => {
                    if (typeof Capacitor !== "undefined") {
                        e.preventDefault();
                        window.open(mailtoUrl, "_system");
                    }
                };
            }
            const playBtn = el("playStoreBtn");
            if (playBtn) {
                const platform = typeof Capacitor !== "undefined" ? Capacitor.getPlatform() : "web";
                if (platform !== "ios") {
                    playBtn.classList.remove("hidden");
                    playBtn.href = S("play_store_url");
                    playBtn.innerText = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform() ? S("play_store_rate_label") : S("play_store_get_label");
                }
            }
            setInterval(() => {
                updateLiveCounter();
                NotificationManager.checkWebFallback();
            }, 1e3);
            await NotificationManager.init();
            initNativeFeatures();
            updateSEO();
            checkVersion();
            setTimeout(checkInstall, 3e3);
        }, 50);
    }
    window.addEventListener("load", init);
    let userApprovedRefresh = false;
    function initServiceWorker() {
        if (!("serviceWorker" in navigator)) return;
        if (window.Capacitor && window.Capacitor.isNativePlatform()) return;
        navigator.serviceWorker.register("sw.js").then(reg => {
            console.log("✅ SW Registered");
            if (reg.waiting) {
                showUpdateToast(reg);
            }
            reg.addEventListener("updatefound", () => {
                const newWorker = reg.installing;
                newWorker.addEventListener("statechange", () => {
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        showUpdateToast(reg);
                    }
                });
            });
        });
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (userApprovedRefresh) {
                window.location.reload();
            }
        });
    }
    function showUpdateToast(reg) {
        const container = el("toast-container");
        if (!container || el("update-toast")) return;
        const toast = document.createElement("div");
        toast.id = "update-toast";
        toast.className = "w-full max-w-sm p-4 rounded-2xl shadow-2xl flex justify-between items-center pointer-events-auto bg-white dark:bg-[#2d2426] text-slate-700 dark:text-rose-100 border border-slate-200 dark:border-white/10 animate-fade-in";
        toast.innerHTML = `\n            <div class="flex flex-col">\n                <span class="text-[10px] uppercase tracking-widest opacity-70">${S("app_title", "Tahara")}</span>\n                <span class="text-xs font-bold">${S("update_available", "Update ready!")}</span>\n            </div>\n            <button id="execRefresh" class="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2 rounded-full text-xs font-black shadow-lg active:scale-95 transition-all">\n                ${S("btn_refresh", "REFRESH")}\n            </button>\n        `;
        container.appendChild(toast);
        const btn = el("execRefresh");
        btn.onclick = e => {
            e.stopPropagation();
            userApprovedRefresh = true;
            const worker = reg.waiting || reg.installing || reg.active;
            if (worker) {
                worker.postMessage({
                    type: "SKIP_WAITING"
                });
                setTimeout(() => window.location.reload(), 1e3);
            } else {
                window.location.reload();
            }
        };
    }
    window.activateUpdate = () => {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg && reg.waiting) {
                reg.waiting.postMessage({
                    type: "SKIP_WAITING"
                });
            } else {
                window.location.reload();
            }
        });
    };
})();
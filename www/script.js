(() => {
    // 1. APP STATE
    const App = {
        uiStrings: {},
        currentLang: localStorage.getItem("tahara_userLang") || (navigator.language.startsWith('ar') ? 'ar' : 'en'),
        isDark: localStorage.getItem("tahara_darkMode") === "true",
        status: localStorage.getItem("tahara_status") || "purity",
        lastChanged: localStorage.getItem("tahara_last_changed") || new Date().toISOString(),
        history: JSON.parse(localStorage.getItem("tahara_history") || "[]"),
    };

    const el = (id) => document.getElementById(id);
    let calDate = new Date();

    function S(key, fallback) { return App.uiStrings[key] || fallback || ""; }

    // 2. CALENDAR ENGINE
    window.changeMonth = (delta) => {
        calDate.setMonth(calDate.getMonth() + delta);
        renderCalendar();
    };

    function renderCalendar() {
        const grid = el("calendarDays");
        const monthLabel = el("calMonthYear");
        const weekHeader = el("calendarWeekdays");
        const legendContainer = el("calendarLegend"); // New target for Legend

        if (!grid || !monthLabel) return;

        // Force Sort: Newest -> Oldest
        App.history.sort((a, b) => new Date(b.time) - new Date(a.time));

        grid.innerHTML = "";

        // A. Header: Month Name
        const monthName = calDate.toLocaleString(App.currentLang, { month: 'long', year: 'numeric' });
        monthLabel.innerText = monthName;

        // B. Weekdays
        const daysAr = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
        const daysEn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const days = App.currentLang === 'ar' ? daysAr : daysEn;
        if (weekHeader) {
            weekHeader.innerHTML = days.map(d => `<span class="text-[9px] text-slate-300 font-bold">${d}</span>`).join('');
        }

        // C. INJECT LEGEND (New)
        if (legendContainer) {
            legendContainer.innerHTML = `
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-200 dark:bg-amber-800"></span> <span class="text-slate-400">${S("status_purity", "Purity")}</span></div>
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-purple-300 dark:bg-purple-800"></span> <span class="text-slate-400">${S("status_change", "Change")}</span></div>
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-200 dark:bg-rose-800"></span> <span class="text-slate-400">${S("status_hayd", "Hayd")}</span></div>
            `;
        }

        // D. Draw Days
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const now = new Date();

        // Padding
        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day, 23, 59, 59);

            // LOGIC: Did any change happen TODAY?
            const hasTransition = App.history.some(e => {
                const d = new Date(e.time);
                return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
            });

            // LOGIC: What was the state at the END of the day?
            const endState = getStateForDate(currentDayDate);

            // E. 3-COLOR SYSTEM
            let bgClass = "";
            let textClass = "";

            if (hasTransition) {
                // Color 3: TRANSITION (Purple/Lavender)
                bgClass = "bg-purple-100 dark:bg-purple-900/40";
                textClass = "text-purple-600 dark:text-purple-200 font-bold";
            } else if (endState === 'hayd') {
                // Color 2: HAYD (Rose)
                bgClass = "bg-rose-100 dark:bg-rose-500/20";
                textClass = "text-rose-500 dark:text-rose-200 font-bold";
            } else {
                // Color 1: PURITY (Amber)
                bgClass = "bg-amber-50 dark:bg-amber-900/10";
                textClass = "text-amber-600 dark:text-amber-200 font-medium";
            }

            // Highlight "Today"
            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            const borderClass = isToday ? "ring-2 ring-amber-400 font-black z-10 scale-110" : "";

            grid.innerHTML += `
                <div class="h-8 w-8 flex items-center justify-center text-[10px] rounded-full mx-auto mb-1 transition-all ${bgClass} ${textClass} ${borderClass}">
                    ${day}
                </div>
            `;
        }
    }

    function getStateForDate(dateObj) {
        const entry = App.history.find(e => new Date(e.time) <= dateObj);
        return entry ? entry.status : 'purity';
    }

    // ... (Keep existing updateStatusUI, renderHistory, logic functions exactly as they were) ...
    // Copy/paste the rest of the functions (updateStatusUI, renderHistory, saveState, export/import etc) from the previous step here.

    // UI UPDATER
    function updateStatusUI() {
        const orb = document.querySelector(".status-orb");
        const statusText = el("current-state-text");
        const actionBtn = el("mainActionBtn");
        const descText = document.querySelector("[data-i18n='status_desc']");

        if (App.status === "purity") {
            statusText.innerText = S("status_purity", "Purity");
            statusText.className = "text-3xl font-black text-amber-600 dark:text-amber-100 transition-colors";
            actionBtn.innerText = S("btn_start_flow", "Mark Flow Started");
            actionBtn.style.background = "#fb7185";
            orb.classList.remove("status-hayd-pulse");
            if (descText) descText.innerText = S("status_desc", "You are eligible for Prayer.");
        } else {
            statusText.innerText = S("status_hayd", "Hayd");
            statusText.className = "text-3xl font-black text-rose-500 dark:text-rose-300 transition-colors";
            actionBtn.innerText = S("btn_end_flow", "Mark Purity Achieved");
            actionBtn.style.background = "#10b981";
            orb.classList.add("status-hayd-pulse");
            if (descText) descText.innerText = S("status_hayd_desc", "Prayer paused.");
        }
    }

    function renderHistory() {
        const list = el("history-list");
        const drawer = el("history-drawer");
        if (App.history.length === 0) { drawer.style.opacity = "0"; return; }

        drawer.classList.remove("opacity-0", "translate-y-10");
        drawer.style.opacity = "1";

        let html = App.history.slice(0, 5).map(entry => {
            const dot = entry.status === 'hayd' ? 'bg-rose-400' : 'bg-amber-300';
            const label = entry.status === 'hayd' ? S("status_hayd", "Hayd") : S("status_purity", "Purity");
            const textCol = entry.status === 'hayd' ? 'dark:text-rose-200' : 'dark:text-amber-100';

            return `<div class="flex justify-between text-[10px] pb-2 border-b border-rose-50/50 dark:border-rose-900/10 animate-fade-in">
                <div class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full ${dot}"></span>
                <span class="${textCol} font-medium">${label}</span></div>
                <span class="text-slate-300 dark:text-slate-500">${new Date(entry.time).toLocaleDateString(App.currentLang)}</span>
            </div>`;
        }).join('');

        html += `<div class="flex gap-2 mt-4">
            <button id="viewFullBtn" class="flex-1 py-2 text-[10px] text-rose-500 dark:text-rose-200 font-bold uppercase border border-rose-100 rounded-full dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-white/5 transition-all">
                ${S("full_insights", "Full Insights")}
            </button>
            <button id="undoBtn" class="px-4 py-2 text-[10px] text-slate-400 border border-slate-100 rounded-full dark:border-rose-900/30 hover:text-rose-500">↩</button>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-6 border-t border-rose-50 dark:border-white/5 pt-4">
            <button id="backupBtn" class="text-[9px] text-slate-400 hover:text-rose-500 uppercase tracking-wider font-bold">${S("btn_backup", "Backup")}</button>
            <button id="restoreBtn" class="text-[9px] text-slate-400 hover:text-rose-500 uppercase tracking-wider font-bold">${S("btn_restore", "Restore")}</button>
            <button id="clearDataBtn" class="text-[9px] text-rose-300 hover:text-rose-500 uppercase tracking-wider font-bold">${S("clear_data", "Reset")}</button>
        </div>`;

        list.innerHTML = html;
        setTimeout(() => {
            el("viewFullBtn").onclick = () => window.openInsights();
            el("undoBtn").onclick = deleteLastEntry;
            el("backupBtn").onclick = exportData;
            el("restoreBtn").onclick = importData;
            el("clearDataBtn").onclick = clearAllData;
        }, 0);
    }

    // --- LOGIC HELPERS ---
    function saveState() {
        App.history.sort((a, b) => new Date(b.time) - new Date(a.time));
        localStorage.setItem("tahara_status", App.status);
        localStorage.setItem("tahara_history", JSON.stringify(App.history));
        localStorage.setItem("tahara_last_changed", App.lastChanged);
    }

    function toggleStatus() {
        App.status = App.status === "purity" ? "hayd" : "purity";
        App.lastChanged = new Date().toISOString();
        App.history.unshift({status: App.status, time: App.lastChanged});
        saveState();
        updateStatusUI();
        renderHistory();
        updateLiveCounter();
    }

    function exportData() {
        const data = { tahara_status: App.status, tahara_last_changed: App.lastChanged, tahara_history: App.history, export_date: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tahara-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
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
                    if (!data.tahara_history) throw new Error("Invalid file");
                    if(confirm(S("import_confirm", "Overwrite current data?"))) {
                        App.status = data.tahara_status;
                        App.lastChanged = data.tahara_last_changed;
                        App.history = data.tahara_history;
                        saveState();
                        // Import DOES need a reload to ensure all state propagates cleanly
                        location.reload();
                    }
                } catch (err) { alert(S("import_error", "Error: Invalid backup file.")); }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function deleteLastEntry() {
        if (confirm(S("delete_confirm", "Delete last entry?"))) {
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
            renderHistory();
            updateLiveCounter();
        }
    }

    function clearAllData() {
        if (confirm(S("clear_confirm", "Clear all?"))) {
            localStorage.clear(); // Careful: clears domain data
            // Reset App State in Memory
            App.history = [];
            App.status = "purity";
            App.lastChanged = new Date().toISOString();

            // Re-Render without reload
            updateStatusUI();
            renderHistory();
            updateLiveCounter();
        }
    }

    function updateLiveCounter() {
        const diff = Math.max(0, new Date() - new Date(App.lastChanged));
        const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
        const l = App.currentLang === 'ar' ? ['ي', 'س', 'د', 'ث'] : ['d', 'h', 'm', 's'];
        const elTimer = el("time-elapsed");
        if (elTimer) elTimer.innerText = `${d}${l[0]} ${h}${l[1]} ${m}${l[2]} ${s}${l[3]}`;
    }

    function calculateAverages() {
        if (App.history.length < 2) return;
        let hTotal = 0, hCount = 0, pTotal = 0, pCount = 0;
        for (let i = 0; i < App.history.length - 1; i++) {
            const duration = new Date(App.history[i].time) - new Date(App.history[i + 1].time);
            if (App.history[i].status === "purity") { hTotal += duration; hCount++; }
            else { pTotal += duration; pCount++; }
        }
        const toDays = (ms, count) => count > 0 ? Math.round(ms / 86400000 / count) + 'd' : '--';
        if (el("avgCycleText")) el("avgCycleText").innerText = toDays(hTotal, hCount);
        if (el("avgPurityText")) el("avgPurityText").innerText = toDays(pTotal, pCount);
    }

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

    async function init() {
        try {
            const res = await fetch("strings.json");
            const raw = await res.json();
            App.uiStrings = raw[App.currentLang] || raw['en'];
        } catch (e) {}

        document.documentElement.dir = App.currentLang === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = App.currentLang;
        document.body.classList.toggle("dark", App.isDark);
        const langSel = el("langSelect");
        if (langSel) langSel.value = App.currentLang;

        document.querySelectorAll("[data-i18n]").forEach(node => {
            const key = node.getAttribute("data-i18n");
            if (S(key)) node.innerText = S(key);
        });

        updateStatusUI();
        renderHistory();
        updateLiveCounter();
        setInterval(updateLiveCounter, 1000);
        checkVersion();

        el("mainActionBtn").onclick = toggleStatus;
        el("themeToggle").onclick = () => {
            App.isDark = !App.isDark;
            localStorage.setItem("tahara_darkMode", App.isDark);
            document.body.classList.toggle("dark", App.isDark);
        };
        if (langSel) langSel.onchange = (e) => {
            localStorage.setItem("tahara_userLang", e.target.value);
            location.reload();
        };
    }

    window.openInsights = () => {
        el("insightsModal").classList.remove("hidden");
        setTimeout(() => el("modalContent").classList.remove("translate-y-full"), 10);
        calculateAverages();
        renderCalendar();
        renderFullInsights();
    };

    window.closeInsights = () => {
        el("modalContent").classList.add("translate-y-full");
        setTimeout(() => el("insightsModal").classList.add("hidden"), 500);
    };

    function renderFullInsights() {
        const fullList = el("fullHistoryList");
        if (!fullList) return;
        fullList.innerHTML = App.history.map(entry => {
            const date = new Date(entry.time);
            const label = entry.status === 'hayd' ? S("status_hayd", "Hayd") : S("status_purity", "Purity");
            const color = entry.status === 'hayd' ? 'text-rose-500 dark:text-rose-200' : 'text-amber-600 dark:text-amber-100';
            return `<div class="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex justify-between items-center">
                <span class="text-sm font-bold ${color}">${label}</span>
                <span class="text-[10px] text-slate-400">${date.toLocaleString(App.currentLang)}</span>
            </div>`;
        }).join('');
    }

    window.onload = init;
})();
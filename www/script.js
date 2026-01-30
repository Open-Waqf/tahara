(() => {
    // 1. APP STATE
    const App = {
        uiStrings: {},
        currentLang: localStorage.getItem("tahara_userLang") || (navigator.language.startsWith('ar') ? 'ar' : 'en'),
        isDark: localStorage.getItem("tahara_darkMode") === "true",
        status: localStorage.getItem("tahara_status") || "purity",
        lastChanged: localStorage.getItem("tahara_last_changed") || new Date().toISOString(),
        history: JSON.parse(localStorage.getItem("tahara_history") || "[]"),
        fasting: JSON.parse(localStorage.getItem("tahara_fasting") || '{"missed":0, "paid":0}')
    };

    const el = (id) => document.getElementById(id);
    let calDate = new Date();

    function S(key, fallback) {
        return App.uiStrings[key] || fallback || "";
    }

    updateContextMessage// 2. CONTEXT LOGIC (Smart Day 0 vs Day 1+)
    function updateContextMessage() {
        const descText = document.querySelector("[data-i18n='status_desc']");
        if (!descText) return;

        const now = new Date();
        const diffMs = now - new Date(App.lastChanged);
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hour = now.getHours();

        if (App.status === "purity") {
            // IF DAY 0: Give specific "What to Pray" advice
            if (days === 0) {
                if (hour >= 4 && hour < 12) {
                    descText.innerText = S("msg_purity_day0_morning", "You just became pure. Perform Ghusl and pray Fajr.");
                } else if (hour >= 12 && hour < 17) {
                    descText.innerText = S("msg_purity_day0_afternoon", "You just became pure. Perform Ghusl. You should pray Zuhr and Asr.");
                } else {
                    descText.innerText = S("msg_purity_day0_evening", "You just became pure. Perform Ghusl. You should pray Maghrib and Isha.");
                }
                descText.classList.add("text-amber-600", "font-bold"); // Highlight advice
            }
            // IF DAY 1+: General encouragement
            else {
                descText.innerText = S("msg_purity_general", "You are in a state of purity. Keep your heart attached to Salah.");
                descText.classList.remove("text-amber-600", "font-bold");
            }
        } else {
            // HAYD LOGIC (Same as before)
            if (days >= 15) {
                descText.innerText = S("msg_hayd_warning_shafi", "Day 15+. Exceeding 15 days is considered Istihadah. You must resume prayer.");
                descText.classList.add("text-rose-600", "font-bold");
            } else if (days >= 10) {
                descText.innerText = S("msg_hayd_warning_hanafi", "Day 10+. Exceeding 10 days is considered Istihadah in Hanafi fiqh.");
                descText.classList.add("text-rose-600", "font-bold");
            } else if (days <= 3) {
                descText.innerText = S("msg_hayd_early", "Prayer and Fasting are paused. Rest is an act of worship.");
                descText.classList.remove("text-rose-600", "font-bold");
            } else {
                descText.innerText = S("msg_hayd_generic", "Prayer paused. Taking care of your health is worship.");
                descText.classList.remove("text-rose-600", "font-bold");
            }
        }
    }

    // 3. FASTING LOGIC
    function saveFasting() {
        localStorage.setItem("tahara_fasting", JSON.stringify(App.fasting));
        updateFastingUI();
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

    function updateFastingUI() {
        const remaining = App.fasting.missed - App.fasting.paid;
        if (el("debtDisplay")) el("debtDisplay").innerText = remaining;
        if (el("totalMissed")) el("totalMissed").innerText = App.fasting.missed;
        if (el("totalPaid")) el("totalPaid").innerText = App.fasting.paid;
        const dot = el("debtDot");
        if (dot) {
            (remaining > 0) ? dot.classList.remove("hidden") : dot.classList.add("hidden");
        }
    }

    window.openFasting = () => {
        const modal = el("fastingModal");
        const content = el("fastingContent");
        modal.classList.remove("hidden");
        setTimeout(() => {
            content.classList.remove("scale-95", "opacity-0");
            content.classList.add("scale-100", "opacity-100");
        }, 10);
        updateFastingUI();
    };

    window.closeFasting = () => {
        const modal = el("fastingModal");
        const content = el("fastingContent");
        content.classList.remove("scale-100", "opacity-100");
        content.classList.add("scale-95", "opacity-0");
        setTimeout(() => modal.classList.add("hidden"), 300);
    };

    // 4. CALENDAR ENGINE
    window.changeMonth = (delta) => {
        calDate.setMonth(calDate.getMonth() + delta);
        renderCalendar();
    };

    function renderCalendar() {
        const grid = el("calendarDays");
        const monthLabel = el("calMonthYear");
        const weekHeader = el("calendarWeekdays");
        const legendContainer = el("calendarLegend");

        if (!grid || !monthLabel) return;
        App.history.sort((a, b) => new Date(b.time) - new Date(a.time));
        grid.innerHTML = "";

        monthLabel.innerText = calDate.toLocaleString(App.currentLang, {month: 'long', year: 'numeric'});

        const daysAr = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
        const daysEn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const days = App.currentLang === 'ar' ? daysAr : daysEn;
        if (weekHeader) {
            weekHeader.innerHTML = days.map(d => `<span class="text-[11px] text-slate-500 dark:text-slate-400 font-bold">${d}</span>`).join('');
        }

        if (legendContainer) {
            legendContainer.innerHTML = `
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-200 dark:bg-amber-700"></span> <span class="text-slate-500 dark:text-slate-300 font-bold">${S("status_purity", "Purity")}</span></div>
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-purple-300 dark:bg-purple-700"></span> <span class="text-slate-500 dark:text-slate-300 font-bold">${S("status_change", "Change")}</span></div>
                <div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-rose-200 dark:bg-rose-700"></span> <span class="text-slate-500 dark:text-slate-300 font-bold">${S("status_hayd", "Hayd")}</span></div>
            `;
        }

        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const now = new Date();

        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayDate = new Date(year, month, day, 23, 59, 59);
            const hasTransition = App.history.some(e => {
                const d = new Date(e.time);
                return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
            });
            const endState = getStateForDate(currentDayDate);

            let bgClass = "", textClass = "";
            if (hasTransition) {
                bgClass = "bg-purple-100 dark:bg-purple-900/60";
                textClass = "text-purple-700 dark:text-purple-100 font-bold";
            } else if (endState === 'hayd') {
                bgClass = "bg-rose-100 dark:bg-rose-500/30";
                textClass = "text-rose-600 dark:text-rose-100 font-bold";
            } else {
                bgClass = "bg-amber-50 dark:bg-amber-900/20";
                textClass = "text-amber-700 dark:text-amber-200 font-bold";
            }
            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
            const borderClass = isToday ? "ring-2 ring-amber-500 font-black z-10 scale-110" : "";
            grid.innerHTML += `<div class="h-8 w-8 flex items-center justify-center text-[12px] rounded-full mx-auto mb-1 transition-all ${bgClass} ${textClass} ${borderClass}">${day}</div>`;
        }
    }

    function getStateForDate(dateObj) {
        const entry = App.history.find(e => new Date(e.time) <= dateObj);
        return entry ? entry.status : 'purity';
    }

    // 5. UI UPDATER
    function updateStatusUI() {
        const orb = document.querySelector(".status-orb");
        const statusText = el("current-state-text");
        const actionBtn = el("mainActionBtn");

        updateContextMessage();

        if (App.status === "purity") {
            statusText.innerText = S("status_purity", "Purity");
            statusText.className = "text-3xl font-black text-amber-600 dark:text-amber-100 transition-colors";
            actionBtn.innerText = S("btn_start_flow", "Mark Flow Started");
            actionBtn.style.background = "#fb7185";
            orb.classList.remove("status-hayd-pulse");
        } else {
            statusText.innerText = S("status_hayd", "Hayd");
            statusText.className = "text-3xl font-black text-rose-500 dark:text-rose-300 transition-colors";
            actionBtn.innerText = S("btn_end_flow", "Mark Purity Achieved");
            actionBtn.style.background = "#10b981";
            orb.classList.add("status-hayd-pulse");
        }
        updateFastingUI();
    }

    function formatDateTime(isoString) {
        const d = new Date(isoString);
        return d.toLocaleString(App.currentLang, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
    }

    function renderHistory() {
        const list = el("history-list");
        const drawer = el("history-drawer");
        drawer.classList.remove("opacity-0", "translate-y-10");
        drawer.style.opacity = "1";
        let html = "";

        if (App.history.length === 0) {
            html = `<div class="text-center text-slate-400 text-xs py-4 italic">No history yet</div>`;
        } else {
            html = App.history.slice(0, 5).map(entry => {
                const dot = entry.status === 'hayd' ? 'bg-rose-400' : 'bg-amber-400';
                const label = entry.status === 'hayd' ? S("status_hayd", "Hayd") : S("status_purity", "Purity");
                const textCol = entry.status === 'hayd' ? 'dark:text-rose-200' : 'dark:text-amber-100';
                return `<div class="flex justify-between text-xs pb-2 border-b border-rose-50/50 dark:border-rose-900/10 animate-fade-in">
                    <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full ${dot}"></span>
                    <span class="${textCol} font-bold text-slate-600">${label}</span></div>
                    <span class="text-slate-500 dark:text-slate-400 font-medium text-[10px]">${formatDateTime(entry.time)}</span>
                </div>`;
            }).join('');
        }

        html += `<div class="flex gap-2 mt-4">
            <button id="viewFullBtn" class="flex-1 py-3 text-xs text-rose-600 dark:text-rose-200 font-bold uppercase border border-rose-200 rounded-full dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-white/5 transition-all">${S("full_insights", "Full Insights")}</button>
            <button id="undoBtn" class="px-5 py-3 text-xs text-slate-500 border border-slate-200 rounded-full dark:border-rose-900/30 hover:text-rose-500">↩</button>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-6 border-t border-rose-50 dark:border-white/5 pt-4">
            <button id="backupBtn" class="text-[10px] text-slate-500 hover:text-rose-500 uppercase tracking-wider font-bold">${S("btn_backup", "Backup")}</button>
            <button id="restoreBtn" class="text-[10px] text-slate-500 hover:text-rose-500 uppercase tracking-wider font-bold">${S("btn_restore", "Restore")}</button>
            <button id="clearDataBtn" class="text-[10px] text-rose-400 hover:text-rose-600 uppercase tracking-wider font-bold">${S("clear_data", "Reset")}</button>
        </div>`;

        list.innerHTML = html;
        setTimeout(() => {
            if (el("viewFullBtn")) el("viewFullBtn").onclick = () => window.openInsights();
            if (el("undoBtn")) el("undoBtn").onclick = deleteLastEntry;
            if (el("backupBtn")) el("backupBtn").onclick = exportData;
            if (el("restoreBtn")) el("restoreBtn").onclick = importData;
            if (el("clearDataBtn")) el("clearDataBtn").onclick = clearAllData;
        }, 0);
    }

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
        const data = {
            tahara_status: App.status,
            tahara_last_changed: App.lastChanged,
            tahara_history: App.history,
            tahara_fasting: App.fasting,
            export_date: new Date().toISOString()
        };
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
                    if (confirm(S("import_confirm", "Overwrite current data?"))) {
                        App.status = data.tahara_status;
                        App.lastChanged = data.tahara_last_changed;
                        App.history = data.tahara_history;
                        App.fasting = data.tahara_fasting || {missed: 0, paid: 0};
                        saveState();
                        saveFasting();
                        location.reload();
                    }
                } catch (err) {
                    alert(S("import_error", "Error: Invalid backup file."));
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function deleteLastEntry() {
        if (App.history.length === 0) return;
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
            localStorage.clear();
            App.history = [];
            App.fasting = {missed: 0, paid: 0};
            App.status = "purity";
            App.lastChanged = new Date().toISOString();
            updateStatusUI();
            renderHistory();
            updateLiveCounter();
        }
    }

    function updateLiveCounter() {
        const diff = Math.max(0, new Date() - new Date(App.lastChanged));
        const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000),
            m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
        const l = App.currentLang === 'ar' ? ['ي', 'س', 'د', 'ث'] : ['d', 'h', 'm', 's'];
        const elTimer = el("time-elapsed");
        if (elTimer) elTimer.innerText = `${d}${l[0]} ${h}${l[1]} ${m}${l[2]} ${s}${l[3]}`;

        // NEW: Check context message every second too (in case hour changes)
        updateContextMessage();
    }

    function calculateAverages() {
        if (App.history.length < 2) {
            if (el("avgCycleText")) el("avgCycleText").innerText = "--";
            if (el("avgPurityText")) el("avgPurityText").innerText = "--";
            return;
        }
        let hTotal = 0, hCount = 0, pTotal = 0, pCount = 0;
        for (let i = 0; i < App.history.length - 1; i++) {
            const duration = new Date(App.history[i].time) - new Date(App.history[i + 1].time);
            if (App.history[i].status === "purity") {
                hTotal += duration;
                hCount++;
            } else {
                pTotal += duration;
                pCount++;
            }
        }
        const unit = S("unit_days", "d");
        const toDays = (ms, count) => count > 0 ? Math.round(ms / 86400000 / count) + unit : '--';
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
        } catch (e) {
        }
    }

    async function init() {
        try {
            const res = await fetch("strings.json");
            const raw = await res.json();
            App.uiStrings = raw[App.currentLang] || raw['en'];
        } catch (e) {
        }

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
        if (el("fastingBtn")) el("fastingBtn").onclick = openFasting;

        if (langSel) langSel.onchange = (e) => {
            localStorage.setItem("tahara_userLang", e.target.value);
            location.reload();
        };
    }

    window.openInsights = () => {
        el("insightsModal").classList.remove("hidden");
        const scrollContainer = el("modalContent").querySelector(".overflow-y-auto");
        if (scrollContainer) scrollContainer.scrollTop = 0;
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
            const label = entry.status === 'hayd' ? S("status_hayd", "Hayd") : S("status_purity", "Purity");
            const color = entry.status === 'hayd' ? 'text-rose-600 dark:text-rose-200' : 'text-amber-700 dark:text-amber-100';
            return `<div class="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex justify-between items-center">
                <span class="text-sm font-bold ${color}">${label}</span>
                <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">${formatDateTime(entry.time)}</span>
            </div>`;
        }).join('');
    }

    window.onload = init;
})();
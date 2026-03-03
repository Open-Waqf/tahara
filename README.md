# Tahara (طهارة) - Private Islamic Purity Tracker

Tahara is a professional-grade, privacy-focused, offline-first Progressive Web App (PWA) designed to help Muslim women track their purity states (Hayd/Tuhr) and determine Salah/Fasting eligibility with precision and security.

> This project is part of the **Open Waqf** umbrella (open-waqf.org). 
> Global organization principles (Amanah, Universal Benefit, Offline-First) apply.

## 🌟 Key Features

* **🔒 100% Private:** No cloud, no analytics, no servers. Your health data stays in **IndexedDB** on your device.
* **⚖️ Multi-Madhhab Fiqh Engine:**
    * **Logic-Based Detection:** Supports **Hanafi, Shafi'i, Maliki, and Hanbali** rules.
    * **Advanced Maliki Logic:** Implements *Istizhar* (Habit + 3 days) calculations based on user habit input.
    * **Classical Sources:** Built upon authoritative texts including *Mukhtasar al-Quduri*, *Minhaj al-Talibin*, *Mukhtasar Khalil*, and *Zad al-Mustaqni*.
* **🛡️ Privacy Vault:** Secure your data with native **Biometrics (FaceID/TouchID)** or a **PIN Code** (AES-256 encrypted).
* **🌙 Ramadan Ledger:** A dedicated tracker for missed fasts (Qada) and payment progress with local reminders.
* **📊 Cycle Insights:** Automated calculation of average cycle/hayd length and future cycle predictions.
* **🌍 Multi-lingual & RTL:** Full RTL (Right-to-Left) UI mirroring for Arabic, plus English, French, Spanish, and Italian.

## 🛠️ Tech Stack

* **Core:** Vanilla JavaScript (ES Modules), HTML5, CSS3 (No frameworks).
* **Styling:** Tailwind CSS v4 (Minified).
* **Storage:** **IndexedDB** (Sensitive data) + LocalStorage (Settings).
* **Platform:** PWA + **Capacitor v8** (Native Android/iOS integration).

## 📉 Low-Connectivity & Global Access Standards

Tahara is engineered for high performance in resource-constrained environments:
* **DIST-01:** Fully functional on **Android Go** devices (512MB RAM).
* **DIST-02:** Total install size (PWA cache) is under **500 KB**. 
* **DIST-03:** Support for **Direct APK Distribution** for markets without Google Play access.
* **Performance Budget:** Strict **35kB JS** and **20kB CSS** limits per build.

## 🏗️ Architectural Pillars

* **Stateless Engine**: All calculations are "pure functions" in `engine.js`, making them independently auditable and testable.
* **Data Amanah**: Strict schema migrations (`runDataMigrations`) ensure data integrity across app updates.
* **Zero-Cloud Policy**: No external APIs, CDNs, or tracking scripts. All assets are local.
* **Auditability**: Scholars and developers can verify the engine using the [Synthetic Test-Vector Corpus](VECTORS.md).

## 🧪 Documentation & Audit

For legal, religious, and technical governance, please refer to:
* **[GOVERNANCE.md](GOVERNANCE.md):** Detailed Fiqh sources and calculation logic.
* **[FIQH_CONTRIBUTORS.md](FIQH_CONTRIBUTORS.md):** Legal clarity on religious expertise and non-commercial use.
* **[VECTORS.md](VECTORS.md):** Guide for auditing the mathematical engine against classical sources.

## 🚀 Development

### Prerequisites
* Node.js & npm (for build tools and native sync).
* Android Studio (for APK generation).
### Installation (Web)

1. Clone the repository.
2. Open `index.html` in your browser.
3. That's it! No build process required for the web version.

### Building for Android (APK)

1. Install dependencies: `npm install`
2. Sync the web assets: `npx cap sync`
3. Open Android Studio: `npx cap open android`
4. Build -> Build Bundle(s) / APK(s) -> Build APK.
### Commands
```bash
npm install        # Install dependencies
npm run dev        # Tailwind watch & Dev server
npm run build      # Production build (Minify CSS)
npm run test:unit  # Run Vitest (Fiqh Engine tests)
npm run test:e2e   # Run Playwright (UI workflows)
npm run size       # Verify bundle size limits
```

### Building for Android
1. `npm run build`
2. `npx cap sync`
3. `npx cap open android`

## 🔒 Privacy Policy

**Tahara collects ZERO data.**
All health data is stored in your device's **IndexedDB**. If you clear your browser cache, you lose your data (unless you use the **Backup/JSON Export** feature).

*Built with ❤️ for the Ummah.*

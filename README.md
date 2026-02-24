# Tahara (طهارة) - Private Islamic Purity Tracker

Tahara is a professional-grade, privacy-focused, offline-first Progressive Web App (PWA) designed to help Muslim women
track their purity states (Hayd/Tuhr) and determine Salah/Fasting eligibility with precision and security.

## 🌟 Key Features

* **🔒 100% Private:** No cloud, no analytics, no servers. Your health data never leaves your device.
* **⚖️ Fiqh-Aware Engine:** * **Logic-Based Detection:** Identifies **Istihadah** based on duration thresholds (e.g., 10
  days Hanafi / 15 days Shafi'i).
    * **Contextual Guidance:** Real-time advice based on current time and state (e.g., "Pray Zuhr & Asr before
      Maghrib").
* **🌙 Ramadan Ledger:** A dedicated tracker for missed fasts (Qada) and payment progress.
* **📊 Cycle Insights:** Automated calculation of average cycle/hayd length and future cycle predictions.
* **🗓️ Daily Health Logs:** Track moods and physical symptoms linked to your cycle.
* **🛡️ Hardened Security:** Strict Content Security Policy (CSP), input validation, and secure JSON data migrations.
* **🌍 Multi-lingual:** Full RTL support for Arabic, plus English, French, Spanish, and Italian.

## 🛠️ Tech Stack

* **Core:** Vanilla JavaScript (ES6+), HTML5, CSS3.
* **Styling:** Tailwind CSS (via CDN/local build).
* **Storage:** LocalStorage (Persistence).
* **Platform:** Progressive Web App (PWA) + Capacitor (Android/iOS).

## 🛠️ Technical Details

### Performance & Performance Budgets

Tahara is optimized for low-end devices. We enforce a **35kB JS budget** and a **20kB CSS budget** via automated CI
checks. Critical path rendering is prioritized, with heavy features lazy-loaded.

### Automated Testing

* **Unit Tests (Vitest):** Core Fiqh logic and engine math are verified for accuracy.
* **E2E Tests (Playwright):** Full user journeys (onboarding, logging, settings) are tested in real browser
  environments.

### Hardened Security

Tahara implements a strict CSP that prohibits `unsafe-inline` scripts, protecting against XSS attacks. All data imports
undergo a strict validation layer before being committed to storage.

### Core Pillars

* **State Management**: The App object is the single source of truth. On every change, we run saveState() which mirrors
  the App object into localStorage.
* **Fiqh Engine**: All calculations are "pure functions" located in engine.js. This makes the logic testable with Vitest
  without needing a browser environment.
* **UI Updates**: We use a "Render-on-Change" pattern. When data changes, we manually call functions like
  updateStatusUI() or renderCalendar() to sync the DOM.
* **Security Layer**: * CSP: A strict policy blocks all inline scripts.
* **Validation**: Data imports are sanitized and type-checked.
* **Privacy**: No external APIs or CDNs are used for data processing.

## 🚀 Development & Build

### Prerequisites

* A modern web browser (Chrome, Safari).
* (Optional) Node.js & npm (for building the Android APK).

### Installation (Web)

1. Clone the repository.
2. Open `index.html` in your browser.
3. That's it! No build process required for the web version.

### Building for Android (APK)

1. Install dependencies: `npm install`
2. Sync the web assets: `npx cap sync`
3. Open Android Studio: `npx cap open android`
4. Build -> Build Bundle(s) / APK(s) -> Build APK.

### Build Styles (Tailwind v4)

```bash
npm run build

```

### Running Tests

```bash
npm run test:unit  # Run logic tests
npm run test:e2e   # Run UI tests (requires Playwright)

```

## 📦 Distribution

* **Web:** Hosted on GitHub Pages via the `deploy` branch.
* **Android:** Capacitor-ready for native APK generation.

## 🔒 Privacy Policy

**Tahara collects ZERO data.**

* We do not use analytics.
* We do not have a backend server.
* Your health data is stored only in your browser's `LocalStorage`.
* If you clear your browser cache, you lose your data (unless you use the **Backup** feature).

### ✅ You Are Free To:

* **Use** this software for personal or community purposes.
* **Modify** the source code.
* **Distribute** your own versions (forks), even if you keep the source code closed.

### ❌ You May NOT:

* **Sell** this software or any derivative works.
* **Place Advertisements** inside the app.
* **Use** this software for any commercial business purpose.

*Built with ❤️ for the Ummah.*
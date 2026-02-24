// playwright.config.js
import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    retries: 1,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        // Disable Service Workers to prevent random reloads during E2E testing
        serviceWorkers: 'block',
        ...devices['Pixel 5'],
    },
    webServer: {
        command: 'npx serve www -l 3000',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
    },
});
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
        command: 'python3 -m http.server 3000 --directory www --bind 127.0.0.1',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
    },
});

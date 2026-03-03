import {describe, expect, test} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {
    OUTPUT_FILE,
    WWW_DIR,
    EXCLUDED_FILES,
    buildAssetList
} = require('./scripts/generate-sw-manifest.cjs');

function parseGeneratedManifest(raw) {
    const match = raw.match(/self\.__TAHARA_SW_MANIFEST\s*=\s*(\{[\s\S]*\});\s*$/);
    if (!match) return null;
    return JSON.parse(match[1]);
}

describe('Service Worker Manifest', () => {
    test('generated manifest exists and is valid', () => {
        expect(fs.existsSync(OUTPUT_FILE)).toBe(true);
        const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
        const manifest = parseGeneratedManifest(raw);
        expect(manifest).not.toBeNull();
        expect(typeof manifest.cacheName).toBe('string');
        expect(manifest.cacheName.startsWith('tahara-')).toBe(true);
        expect(Array.isArray(manifest.assets)).toBe(true);
        expect(manifest.assets.length).toBeGreaterThan(5);
    });

    test('generated assets match current www files', () => {
        const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
        const manifest = parseGeneratedManifest(raw);
        const generated = manifest.assets.slice().sort();
        const expected = buildAssetList().slice().sort();
        expect(generated).toEqual(expected);

        // Guardrail for accidental inclusion of excluded files.
        for (const excluded of EXCLUDED_FILES) {
            expect(generated).not.toContain(`./${excluded}`);
        }
    });

    test('manifest covers key runtime files', () => {
        const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
        const manifest = parseGeneratedManifest(raw);
        const needed = [
            './index.html',
            './script.js',
            './compiled.css',
            './strings.json',
            './manifest.json',
            './theme-init.js'
        ];
        for (const file of needed) {
            expect(fs.existsSync(path.join(WWW_DIR, file.replace('./', '')))).toBe(true);
            expect(manifest.assets).toContain(file);
        }
    });
});

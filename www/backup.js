/**
 * Backup payload normalization and validation.
 * Keeps restore bounded and resilient against malformed data.
 */
import {APP_LIMITS} from './constants.js';

export function normalizeBackupData(rawData, now = new Date()) {
    if (!rawData || typeof rawData !== "object") return null;

    const status = rawData.tahara_status;
    if (!["purity", "hayd"].includes(status)) return null;

    const rawHistory = rawData.tahara_history;
    if (!Array.isArray(rawHistory)) return null;

    const history = [];
    for (const entry of rawHistory) {
        if (!entry || typeof entry !== "object") continue;
        if (!["purity", "hayd"].includes(entry.status)) continue;
        const t = new Date(entry.time);
        if (Number.isNaN(t.getTime())) continue;
        history.push({status: entry.status, time: t.toISOString()});
    }

    const nowIso = now.toISOString();
    const historyFallback = history[0]?.time || nowIso;
    const parsedLastChanged = new Date(rawData.tahara_last_changed);
    const safeLastChanged = Number.isNaN(parsedLastChanged.getTime())
        ? historyFallback
        : parsedLastChanged.toISOString();

    const rawFasting = (rawData.tahara_fasting && typeof rawData.tahara_fasting === "object")
        ? rawData.tahara_fasting
        : {missed: 0, paid: 0};
    const missed = Math.max(0, parseInt(rawFasting.missed) || 0);
    const paid = Math.max(0, Math.min(missed, parseInt(rawFasting.paid) || 0));
    const fasting = {missed, paid};

    const logs = {};
    const rawLogs = (rawData.tahara_logs && typeof rawData.tahara_logs === "object") ? rawData.tahara_logs : {};
    let includedDays = 0;
    for (const [dateKey, tags] of Object.entries(rawLogs)) {
        if (includedDays >= APP_LIMITS.MAX_BACKUP_LOG_DAYS) break;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
        if (!Array.isArray(tags)) continue;

        const cleanTags = tags
            .filter(tag => typeof tag === "string" && tag.length > 0 && tag.length <= 64)
            .slice(0, APP_LIMITS.MAX_BACKUP_TAGS_PER_DAY);
        logs[dateKey] = cleanTags;
        includedDays++;
    }

    const safeExportDate = new Date(rawData.export_date);
    return {
        schema_version: parseInt(rawData.schema_version) || 1,
        tahara_status: status,
        tahara_last_changed: safeLastChanged,
        tahara_history: history,
        tahara_fasting: fasting,
        tahara_logs: logs,
        export_date: Number.isNaN(safeExportDate.getTime()) ? nowIso : safeExportDate.toISOString()
    };
}

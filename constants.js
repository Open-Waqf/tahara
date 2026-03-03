export const APP_LIMITS = {
    MAX_BACKUP_IMPORT_BYTES: 2 * 1024 * 1024,
    MAX_BACKUP_LOG_DAYS: 5000,
    MAX_BACKUP_TAGS_PER_DAY: 20
};

export const APP_RETENTION = {
    RESTORE_AUDIT_MAX_ENTRIES: 50
};

export const APP_TIMINGS = {
    TOAST_VISIBLE_MS: 3000,
    TOAST_FADE_MS: 300,
    RESTORE_DB_SETTLE_MS: 200,
    RESTORE_RELOAD_MS: 500,
    DOWNLOAD_CLEANUP_MS: 150,
    ANNOUNCER_UPDATE_MS: 50,
    HISTORY_TAB_HIGHLIGHT_MS: 1000,
    INSTALL_BANNER_ANIMATE_MS: 100,
    INSTALL_BANNER_HIDE_MS: 500,
    ONBOARDING_FADE_IN_DELAY_MS: 10,
    ONBOARDING_HIDE_MS: 500,
    SW_RELOAD_FALLBACK_MS: 1000,
    INIT_DEFERRED_MS: 50,
    INSTALL_PROMPT_DELAY_MS: 3000,
    LIVE_COUNTER_INTERVAL_MS: 1000
};

export const BUILTIN_FALLBACK_STRINGS = {
    app_title: "Tahara - Islamic Purity & Salah Tracker",
    current_status: "Today",
    status_purity: "Purity",
    status_hayd: "Hayd",
    status_desc: "You are eligible for Prayer and Fasting.",
    btn_start_flow: "Mark Flow Started",
    btn_end_flow: "Mark Purity Achieved",
    no_history: "No history yet",
    msg_welcome: "Welcome to Tahara. Tap below to log your first change.",
    unit_days: "d",
    next_period: "Next Expected",
    prediction_disclaimer: "Estimated based on your history.",
    announce_status: "Status changed to",
    empty_averages: "Log 2 cycles to calculate",
    notif_denied: "Notification permission was denied.",
    notif_title: "Tahara Check-in",
    notif_body: "Don't forget to log your mood and symptoms today.",
    import_error: "Error: Invalid backup file.",
    import_too_large: "Backup file is too large to import safely.",
    import_limit_hint: "Max import size: %size%",
    btn_cancel: "Cancel",
    btn_confirm_restore: "Confirm Restore",
    btn_close: "Close",
    update_available: "Update available!",
    btn_refresh: "Refresh",
    backup_date: "Backup Date:",
    history_entries: "History Entries:",
    daily_logs: "Daily Logs:",
    data_version: "Data Version:",
    preview_restore: "Preview Restore",
    restore_warning: "Applying this will overwrite your current device data permanently.",
    mood_happy: "Happy",
    mood_calm: "Calm",
    mood_irritable: "Irritable",
    mood_sad: "Sad",
    sym_spotting: "Spotting",
    col_white: "White",
    col_yellow: "Yellow",
    col_brown: "Brown",
    col_red: "Red",
    col_black: "Black",
    flow_light: "Light Flow",
    flow_medium: "Medium Flow",
    flow_heavy: "Heavy Flow",
    sym_pain: "Pain",
    sym_fatigue: "Fatigue",
    sym_sleep: "Sleep",
    calendar_weekdays: "S,M,T,W,T,F,S",
    status_change: "Change"
};

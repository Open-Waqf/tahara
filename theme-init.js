(function() {
    const isDark = localStorage.getItem("tahara_darkMode") === "true";
    const userLang = localStorage.getItem("tahara_userLang") || (['ar', 'fr', 'es', 'it'].includes(navigator.language.split('-')[0]) ? navigator.language.split('-')[0] : 'en');

    if (isDark) document.documentElement.classList.add('dark');
    document.documentElement.dir = (userLang === 'ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = userLang;

    // Set initial state for the fade-in
    document.documentElement.style.opacity = '0';
    document.documentElement.style.transition = 'opacity 0.5s ease-in-out';
})();
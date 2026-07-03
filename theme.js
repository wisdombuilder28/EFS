/**
 * theme.js — works for ALL pages in the school website.
 *
 * WHY THIS WAS BROKEN:
 *   • Main site style.css uses  body.dark-mode   { }  for dark styling
 *   • AI page  AI.css    uses   body.light-theme  { }  for light styling
 *   These are opposite conventions. The old code only handled one side
 *   at a time, so fixing one page always broke the other.
 *
 * THIS FIX:
 *   Light mode → add "light-theme",  remove "dark-mode"   ← AI.css responds ✓
 *   Dark  mode → remove "light-theme", add "dark-mode"    ← style.css responds ✓
 *   Both classes are managed together every time, so every page works.
 */
document.addEventListener('DOMContentLoaded', () => {
    const settingsLink  = document.getElementById('open-settings-link');
    const hamburgerMenu = document.getElementById('check');
    const modal         = document.getElementById('settingsModal');
    if (!modal) return;

    const closeBtn     = modal.querySelector('.close-modal');
    const themeButtons = modal.querySelectorAll('.theme-btn');

    // ── Open / close modal ────────────────────────────────────────────────────
    if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            modal.style.display = 'flex';
            if (hamburgerMenu) hamburgerMenu.checked = false;
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    }
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // ── Apply theme ───────────────────────────────────────────────────────────
    const applyTheme = (choice) => {
        // Resolve 'system' to the actual OS preference
        let resolved = choice;
        if (choice === 'system') {
            resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        if (resolved === 'light') {
            document.body.classList.add('light-theme');   // AI.css needs this
            document.body.classList.remove('dark-mode');  // main style.css needs this gone
        } else {
            document.body.classList.remove('light-theme'); // AI.css default is dark
            document.body.classList.add('dark-mode');      // main style.css needs this
        }

        // Save the user's choice (not the resolved value so 'system' stays as 'system')
        localStorage.setItem('theme', choice);

        // Highlight the active button
        themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === choice);
        });
    };

    // Load saved preference (default: dark)
    applyTheme(localStorage.getItem('theme') || 'dark');

    // Button clicks
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => applyTheme(btn.dataset.theme || 'dark'));
    });

    /* If 'system' is chosen, update when the OS preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (localStorage.getItem('theme') === 'system') applyTheme('system');
    });*/
});

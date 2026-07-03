// ── Password is stored as a SHA-256 hash — never as plaintext ────────────────
// To change the password: generate a new SHA-256 hash of your chosen password
// at https://emn178.github.io/online-tools/sha256.html and paste it below.
// Students who view source code only see this hash — it cannot be reversed.
const HASHED_PASSWORD = "57de20f6a6a76f68b3d7702267e588fc0e10965cd64ef1625a163d248ed8109e";

// Brute-force protection: track failed attempts
let failedAttempts = 0;
let lockoutUntil   = 0;

const hashPassword = async (input) => {
    const encoder = new TextEncoder();
    const data    = encoder.encode(input);
    const hash    = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

export function unlockAdmin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('staff-password-input').value = '';
}

const EYE_OPEN = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_SHUT = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

document.getElementById('toggle-password').addEventListener('click', () => {
    const input = document.getElementById('staff-password-input');
    const eye   = document.getElementById('toggle-password');
    if (input.type === 'password') {
        input.type    = 'text';
        // EYE_SHUT is a hardcoded SVG constant — parse it safely
        eye.replaceChildren(document.createRange().createContextualFragment(EYE_SHUT));
    } else {
        input.type    = 'password';
        // EYE_OPEN is a hardcoded SVG constant — parse it safely
        eye.replaceChildren(document.createRange().createContextualFragment(EYE_OPEN));
    }
});

document.getElementById('submit-login').addEventListener('click', async () => {
    const now = Date.now();

    // Lockout after 5 failed attempts — 2-minute timeout
    if (now < lockoutUntil) {
        const secs = Math.ceil((lockoutUntil - now) / 1000);
        alert(`Too many wrong attempts. Please wait ${secs} seconds before trying again.`);
        return;
    }

    const input = document.getElementById('staff-password-input').value;
    if (!input) return;

    const submitBtn = document.getElementById('submit-login');
    submitBtn.disabled  = true;
    submitBtn.innerText = 'Checking...';

    try {
        const hashed = await hashPassword(input);
        if (hashed === HASHED_PASSWORD) {
            failedAttempts = 0;
            lockoutUntil   = 0;
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('posting-area').classList.remove('hidden');
            document.getElementById('staff-password-input').value = '';
        } else {
            failedAttempts++;
            if (failedAttempts >= 5) {
                lockoutUntil = Date.now() + 2 * 60 * 1000; // 2-minute lockout
                failedAttempts = 0;
                alert('Too many wrong attempts. Locked out for 2 minutes.');
            } else {
                alert(`Wrong password! ${5 - failedAttempts} attempt(s) remaining.`);
            }
        }
    } finally {
        submitBtn.disabled  = false;
        submitBtn.innerText = 'Login';
    }
});

// Delete also needs the password — update its check here so it uses the same hash
export const verifyStaffPassword = async (input) => {
    if (!input) return false;
    const hashed = await hashPassword(input);
    return hashed === HASHED_PASSWORD;
};

document.getElementById('close-login').addEventListener('click', () => {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('staff-password-input').value = '';
});

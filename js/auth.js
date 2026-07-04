import { auth, signInWithEmailAndPassword } from './firebase.js';

// ── Staff login now runs on real Firebase Authentication, not a hash check ───
// A hash comparison in the browser can be bypassed entirely from DevTools
// (anyone can call addDoc/deleteDoc directly, skipping this file completely).
// signInWithEmailAndPassword is verified by Firebase's servers, and Firestore
// rules check that real session — so it can't be skipped client-side.
//
// ONE-TIME SETUP (in the Firebase console, console.firebase.google.com):
//   1. Authentication → Sign-in method → enable "Email/Password".
//   2. Authentication → Users → Add user → email: STAFF_EMAIL below,
//      password: whatever your staff password should be.
// STAFF_EMAIL doesn't need to be a real inbox — it's just the account's ID.
// To change the password later, edit that user in the Firebase console.
const STAFF_EMAIL = "staff@emeakarohaschool.edu.ng";

// Brute-force protection: track failed attempts (Firebase also rate-limits
// repeated failures on its own server, this just gives a friendlier message)
let failedAttempts = 0;
let lockoutUntil   = 0;

// Returns true only if Firebase confirms the password for STAFF_EMAIL is correct.
const checkPassword = async (input) => {
    try {
        await signInWithEmailAndPassword(auth, STAFF_EMAIL, input);
        return true;
    } catch (err) {
        if (err.code === 'auth/too-many-requests') throw err; // let caller show a distinct message
        return false;
    }
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
        const ok = await checkPassword(input);
        if (ok) {
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
    } catch (err) {
        if (err.code === 'auth/too-many-requests') {
            alert('Too many attempts. Please wait a few minutes and try again.');
        } else {
            alert('Could not reach the login server. Check your connection and try again.');
        }
    } finally {
        submitBtn.disabled  = false;
        submitBtn.innerText = 'Login';
    }
});

// Delete also needs the password — reuses the same Firebase Auth check
export const verifyStaffPassword = async (input) => {
    if (!input) return false;
    try {
        return await checkPassword(input);
    } catch {
        return false; // e.g. auth/too-many-requests — treat as "can't verify" for delete
    }
};

document.getElementById('close-login').addEventListener('click', () => {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('staff-password-input').value = '';
});

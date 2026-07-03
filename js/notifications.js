// ============================================================
// PUSH NOTIFICATION MANAGER
// Registers the Service Worker and requests notification
// permission automatically after 3 seconds on first visit.
// No button tap needed — works like WhatsApp notifications.
// ============================================================

import { db } from './firebase.js';
import {
    collection, addDoc, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const VAPID_PUBLIC_KEY = "BHpzFXVMgflSmiBKTXZgUZKn-yrILa5OrYvfVAS6hBAX4K2N49CYwMyn5hC90dNeiaaN92RmEvBKlDIzTuxRWus";

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const output  = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
    return output;
}

async function registerSW() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        return reg;
    } catch (err) {
        console.warn("SW registration failed:", err.message);
        return null;
    }
}

async function saveSubscription(subscription) {
    const subJSON  = subscription.toJSON();
    const endpoint = subJSON.endpoint;
    const subsCol  = collection(db, 'push_subscriptions');
    const existing = await getDocs(query(subsCol, where('endpoint', '==', endpoint)));
    if (!existing.empty) return; // already saved
    await addDoc(subsCol, {
        endpoint: subJSON.endpoint,
        keys: {
            p256dh: subJSON.keys?.p256dh || '',
            auth:   subJSON.keys?.auth   || '',
        },
        createdAt: new Date().toISOString(),
    });
}

// ── Main export ───────────────────────────────────────────────────────────────
// bellBtn parameter kept for compatibility but is now hidden.
// Permission is requested automatically after a short delay.
export async function initNotifications(bellBtn) {
    if (!('PushManager' in window)) return;

    const reg = await registerSW();
    if (!reg) return;

    // If already subscribed — silently resubscribe if subscription lapsed
    if (Notification.permission === 'granted') {
        try {
            const existing = await reg.pushManager.getSubscription();
            if (!existing) {
                const newSub = await reg.pushManager.subscribe({
                    userVisibleOnly:      true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                });
                await saveSubscription(newSub);
            }
        } catch (err) {
            console.warn("Auto-resubscribe failed:", err.message);
        }
        return;
    }

    // If already denied — don't ask again
    if (Notification.permission === 'denied') return;

    // First visit — wait 3 seconds then ask for permission naturally
    // This feels like WhatsApp: you open the page, a few seconds later
    // the browser asks "Allow emeakaroha... to send notifications?"
    setTimeout(async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly:      true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
            await saveSubscription(subscription);
        } catch (err) {
            console.warn("Notification setup failed:", err.message);
        }
    }, 3000); // 3 second delay before asking
}

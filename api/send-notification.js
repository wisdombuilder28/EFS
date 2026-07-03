// ============================================================
// VERCEL API FUNCTION: send-notification
// File location: /api/send-notification.js
//
// ENVIRONMENT VARIABLES — set in Vercel dashboard:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   FIREBASE_API_KEY
//   FIREBASE_PROJECT_ID
// ============================================================

import webpush from 'web-push';

webpush.setVapidDetails(
    'mailto:info@emeakarohaschool.edu.ng',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

async function getSubscriptions() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const apiKey    = process.env.FIREBASE_API_KEY;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/push_subscriptions?key=${apiKey}&pageSize=300`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`Firestore read failed: ${res.status}`);

    const data = await res.json();
    if (!data.documents) return [];

    return data.documents.map(doc => {
        const fields = doc.fields || {};
        return {
            endpoint: fields.endpoint?.stringValue || '',
            keys: {
                p256dh: fields.keys?.mapValue?.fields?.p256dh?.stringValue || '',
                auth:   fields.keys?.mapValue?.fields?.auth?.stringValue   || '',
            }
        };
    }).filter(sub => sub.endpoint && sub.keys.p256dh && sub.keys.auth);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { title = 'New Announcement', body = '', category = 'general' } = req.body || {};
    if (!title) return res.status(400).send('Missing title');

    const pushPayload = JSON.stringify({ title, body, category });

    try {
        const subscriptions = await getSubscriptions();
        if (subscriptions.length === 0) return res.status(200).json({ sent: 0, message: 'No subscribers yet' });

        const results = await Promise.allSettled(
            subscriptions.map(sub =>
                webpush.sendNotification(sub, pushPayload, {
                    TTL:     86400,
                    urgency: category === 'urgent' ? 'high' : 'normal',
                })
            )
        );

        const sent   = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        return res.status(200).json({ sent, failed, total: subscriptions.length });

    } catch (err) {
        console.error('send-notification error:', err);
        return res.status(500).send(err.message);
    }
}
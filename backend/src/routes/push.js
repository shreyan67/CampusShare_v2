const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const admin = require('firebase-admin');
const { pool } = require('../db/pool');

// ── Firebase Admin (for native FCM) ──────────────────────────────────────────
let firebaseReady = false;
function ensureFirebase() {
  if (firebaseReady) return true;
  if (!process.env.FIREBASE_CREDENTIALS) {
    console.warn('[push] FIREBASE_CREDENTIALS not set — native FCM push disabled.');
    return false;
  }
  try {
    const creds = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    // Fix: Render env vars store \n as literal backslash-n; convert to real newlines for RSA signing
    if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(creds) });
    }
    firebaseReady = true;
    console.log('[push] Firebase Admin initialised ✓');
    return true;
  } catch (e) {
    console.error('[push] Failed to parse FIREBASE_CREDENTIALS:', e.message);
    return false;
  }
}

// ── VAPID (for web PWA) ───────────────────────────────────────────────────────
let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[push] VAPID keys not set — web push disabled.');
    return false;
  }
  webpush.setVapidDetails(
    'mailto:admin@campusshare.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidReady = true;
  return true;
}

// Eagerly attempt initialisation at startup so log messages appear early
ensureFirebase();
ensureVapid();

// ── POST /api/push/subscribe ──────────────────────────────────────────────────
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, type, adminSecret } = req.body;
    let userId;

    if (type === 'admin') {
      if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: 'Unauthorized admin' });
      }
      userId = 'admin';
    } else {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'No token' });
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.sub || decoded.id; // tokens use 'sub' field
      } catch (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }
    }

    if (!userId || !subscription) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const isFcm = !!(subscription.fcm_token);

    if (isFcm) {
      // For native apps: upsert by user_id so there is always exactly ONE FCM token per user.
      // We delete old FCM rows for this user first, then insert the fresh token.
      await pool.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription::text LIKE '%fcm_token%'`,
        [userId]
      );
      await pool.query(
        `INSERT INTO push_subscriptions (user_id, subscription) VALUES ($1, $2)`,
        [userId, JSON.stringify(subscription)]
      );
      console.log(`[push] FCM token registered for user ${userId}`);
    } else {
      // For PWA: upsert based on endpoint to avoid duplicates
      await pool.query(
        `INSERT INTO push_subscriptions (user_id, subscription)
         VALUES ($1, $2)
         ON CONFLICT (user_id, subscription) DO NOTHING`,
        [userId, JSON.stringify(subscription)]
      );
    }

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[push] Subscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── sendPushNotification(userId, payload) ─────────────────────────────────────
async function sendPushNotification(userId, payload) {
  try {
    const { rows } = await pool.query(
      'SELECT subscription FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (rows.length === 0) {
      console.log(`[push] No subscriptions for user ${userId}`);
      return;
    }

    for (const row of rows) {
      const sub = row.subscription; // Postgres returns JSON column already parsed

      try {
        if (sub && sub.fcm_token) {
          // ── NATIVE: Firebase Cloud Messaging ──
          if (!ensureFirebase()) {
            console.warn('[push] Skipping FCM — Firebase not initialised');
            continue;
          }
          console.log(`[push] Sending FCM to token: ${sub.fcm_token.slice(0, 20)}...`);
          await admin.messaging().send({
            token: sub.fcm_token,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channelId: 'default',
              }
            },
            data: { url: payload.url || '/' }
          });
          console.log(`[push] FCM sent ✓ to user ${userId}`);
        } else {
          // ── WEB: VAPID / Service Worker Push ──
          if (!ensureVapid()) {
            console.warn('[push] Skipping VAPID — keys not set');
            continue;
          }
          await webpush.sendNotification(sub, JSON.stringify(payload));
          console.log(`[push] VAPID sent ✓ to user ${userId}`);
        }
      } catch (err) {
        const expired = err.statusCode === 410 || err.statusCode === 404 ||
          err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token';

        if (expired) {
          console.warn(`[push] Stale subscription for user ${userId}, removing...`);
          await pool.query(
            'DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription::text = $2',
            [userId, JSON.stringify(sub)]
          );
        } else {
          console.error(`[push] Error sending to user ${userId}:`, err.message || err);
        }
      }
    }
  } catch (err) {
    console.error('[push] DB query failed in sendPushNotification:', err);
  }
}

// Send push to all users in a college (except the author) — e.g. new item request
async function notifyCollege(collegeId, excludeUserId, payload) {
  try {
    const { rows } = await pool.query(
       `SELECT s.user_id, s.subscription
        FROM push_subscriptions s
        JOIN users u ON s.user_id = u.id::text
        WHERE u.college_id = $1 AND u.id != $2`,
      [collegeId, excludeUserId]
    );
    console.log(`[push] notifyCollege: collegeId=${collegeId}, found ${rows.length} subscriber(s) to notify`);
    for (const row of rows) {
      const sub = row.subscription;
      try {
        if (sub && sub.fcm_token) {
          if (ensureFirebase()) {
            await admin.messaging().send({
              token: sub.fcm_token,
              notification: { title: payload.title, body: payload.body },
              android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
              data: { url: payload.url || '/' }
            });
            console.log(`[push] notifyCollege: FCM sent to user ${row.user_id}`);
          }
        } else if (ensureVapid()) {
          await webpush.sendNotification(sub, JSON.stringify(payload));
          console.log(`[push] notifyCollege: VAPID sent to user ${row.user_id}`);
        } else {
          console.warn(`[push] notifyCollege: No valid subscription for user ${row.user_id}`);
        }
      } catch (err) {
        console.error(`[push] notifyCollege: Failed for user ${row.user_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[push] notifyCollege failed:', err);
  }
}

module.exports = { router, sendPushNotification, notifyCollege };

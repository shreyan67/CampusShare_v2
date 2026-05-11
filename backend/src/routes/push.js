const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const admin = require('firebase-admin');
const { pool } = require('../db/pool');

// Lazy Firebase Admin setup
let firebaseReady = false;
function ensureFirebase() {
  if (firebaseReady) return true;
  if (!process.env.FIREBASE_CREDENTIALS) {
    console.warn('[push] FIREBASE_CREDENTIALS not set — native FCM push disabled. Add FIREBASE_CREDENTIALS JSON string in .env');
    return false;
  }
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseReady = true;
    return true;
  } catch (e) {
    console.error('[push] Invalid FIREBASE_CREDENTIALS JSON string');
    return false;
  }
}

// Lazy VAPID setup — only called when first needed, so missing env vars
// don't crash the server at startup (they just disable push silently).
let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[push] VAPID keys not set — push notifications disabled. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Render environment variables.');
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

// Subscribe route
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
      // For users, we need them to be authenticated
      // We will extract token from headers
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'No token' });
      
      const jwt = require('jsonwebtoken');
      try {
        const user = jwt.verify(token, process.env.JWT_SECRET);
        userId = user.id;
      } catch (err) {
        return res.status(403).json({ error: 'Invalid token' });
      }
    }

    if (!userId || !subscription) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Save to database
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, subscription) 
       VALUES ($1, $2) 
       ON CONFLICT (user_id, subscription) DO NOTHING`,
      [userId, JSON.stringify(subscription)]
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Utility to send push notification
async function sendPushNotification(userId, payload) {
  if (!ensureVapid()) return; // silently skip if VAPID keys not configured
  try {
    const { rows } = await pool.query(
      'SELECT subscription FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    for (const row of rows) {
      try {
        if (row.subscription.fcm_token) {
          // Send via Firebase Cloud Messaging (Native App)
          if (ensureFirebase()) {
            await admin.messaging().send({
              token: row.subscription.fcm_token,
              notification: {
                title: payload.title,
                body: payload.body,
              },
              data: { url: payload.url || '/' }
            });
          }
        } else {
          // Send via Web Push (PWA)
          if (ensureVapid()) {
            await webpush.sendNotification(row.subscription, JSON.stringify(payload));
          }
        }
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404 || err.code === 'messaging/registration-token-not-registered') {
          // Subscription has expired or is no longer valid
          await pool.query(
            'DELETE FROM push_subscriptions WHERE user_id = $1 AND subscription::text = $2',
            [userId, JSON.stringify(row.subscription)]
          );
        } else {
          console.error('Error sending push:', err);
        }
      }
    }
  } catch (err) {
    console.error('Failed to get push subscriptions from DB:', err);
  }
}

module.exports = { router, sendPushNotification };

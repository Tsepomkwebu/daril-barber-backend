// barber-backend/firebase.js
const admin = require('firebase-admin');

// Load credentials from your FIREBASE_CONFIG env var (or service account file)
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { db };

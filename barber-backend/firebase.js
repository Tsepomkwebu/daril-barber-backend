// barber-backend/firebase.js
const admin = require('firebase-admin');

// Load service account from local JSON file (make sure it's in .gitignore!)
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { db };

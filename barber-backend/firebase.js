// barber-backend/firebase.js
const admin = require('firebase-admin');

// Load service account from local JSON file (make sure it's in .gitignore!)
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = { db };

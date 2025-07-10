// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBKT-m4vDvE4V_GgZ9GiyqZH_qcl4KNNdw",
  authDomain: "barberbooking-afe1b.firebaseapp.com",
  projectId: "barberbooking-afe1b",
  storageBucket: "barberbooking-afe1b.appspot.com",
  messagingSenderId: "51355067988",
  appId: "1:51355067988:web:bec6f00798e7604ad82fc1",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

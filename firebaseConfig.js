// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAZf-KMgaokOF-PVhxgXG64bxWK28_h9-0",
  authDomain: "local-transport-booking-app.firebaseapp.com",
  projectId: "local-transport-booking-app",
  storageBucket: "local-transport-booking-app.appspot.com", // 🔧 fixed domain typo
  messagingSenderId: "603930160592",
  appId: "1:603930160592:web:b24160e5dbb69305ad1dd5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

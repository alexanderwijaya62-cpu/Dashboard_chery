import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAuGLfMAvN_7XPsMRD3ZZFIlhXoFo5q_pc",
  authDomain: "antrianbengkel-dd158.firebaseapp.com",
  databaseURL: "https://antrianbengkel-dd158-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "antrianbengkel-dd158",
  storageBucket: "antrianbengkel-dd158.firebasestorage.app",
  messagingSenderId: "677560605956",
  appId: "1:677560605956:web:321be3f26323802fc0c451",
  measurementId: "G-DPLZT77TXW"
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getDatabase(app);

// Inisialisasi Auth agar bisa menembus Rules Database aman
const auth = getAuth(app);
signInAnonymously(auth).catch((error) => {
  console.error("Gagal melakukan autentikasi ke database:", error);
});
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import * as firebaseAuth from "firebase/auth";

// Cast to any to avoid "has no exported member" errors if types are missing/incompatible
const { getAuth, GoogleAuthProvider, FacebookAuthProvider } = firebaseAuth as any;

// TODO: Thay thế thông tin bên dưới bằng cấu hình từ Firebase Console của bạn
// Truy cập: https://console.firebase.google.com/ -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Khởi tạo Firebase (Sử dụng try-catch để tránh crash app nếu chưa config)
let auth: any = null; // Changed from Auth | null to any
let googleProvider: any = null; // Changed type to any for consistency
let facebookProvider: any = null; // Changed type to any for consistency

try {
  // Chỉ khởi tạo nếu config hợp lệ (ví dụ đơn giản check apiKey)
  if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
      let app: FirebaseApp;
      // Check if app is already initialized to avoid "Firebase: Firebase App named '[DEFAULT]' already exists" error
      if (getApps().length === 0) {
          app = initializeApp(firebaseConfig);
      } else {
          app = getApp();
      }
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
      facebookProvider = new FacebookAuthProvider();
  } else {
      console.warn("Firebase chưa được cấu hình. Vui lòng cập nhật services/firebaseConfig.ts");
  }
} catch (error) {
  console.error("Lỗi khởi tạo Firebase:", error);
}

export { auth, googleProvider, facebookProvider };
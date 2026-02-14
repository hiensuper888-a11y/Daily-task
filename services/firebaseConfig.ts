import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import * as firebaseAuth from "firebase/auth";

// Cast to any to avoid "has no exported member" errors if types are missing/incompatible
const { getAuth, GoogleAuthProvider, FacebookAuthProvider } = firebaseAuth as any;

// TODO: Thay thế thông tin bên dưới bằng cấu hình từ Firebase Console của bạn để dùng tính năng thật
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
let auth: any = null;
let googleProvider: any = null;
let facebookProvider: any = null;
let app: FirebaseApp | null = null;

export const isFirebaseConfigured = () => {
    return firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";
};

try {
  // Chỉ khởi tạo nếu config hợp lệ hoặc để tránh lỗi runtime
  if (isFirebaseConfigured()) {
      // Check if app is already initialized
      if (getApps().length === 0) {
          app = initializeApp(firebaseConfig);
      } else {
          app = getApp();
      }
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
      facebookProvider = new FacebookAuthProvider();
  } else {
      console.warn("Firebase chưa được cấu hình đúng. Ứng dụng sẽ chạy ở chế độ Demo (Giả lập đăng nhập).");
  }
} catch (error) {
  console.error("Lỗi khởi tạo Firebase:", error);
}

export { auth, googleProvider, facebookProvider };
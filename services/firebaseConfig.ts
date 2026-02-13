import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from "firebase/auth";

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
let auth: any = null;
let googleProvider: any = null;
let facebookProvider: any = null;

try {
  // Chỉ khởi tạo nếu config hợp lệ (ví dụ đơn giản check apiKey)
  if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
      const app = initializeApp(firebaseConfig);
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

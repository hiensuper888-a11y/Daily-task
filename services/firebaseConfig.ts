
// SERVICES/FIREBASECONFIG.TS - MOCK IMPLEMENTATION
// This file simulates a Firebase Auth backend using localStorage.
// It allows the app to function with full registration flows as requested, without needing a live Google Cloud project.

const USERS_KEY = 'daily_task_mock_users';
const CURRENT_USER_KEY = 'daily_task_mock_current_user';

// Helper: Get all users from storage
const getUsers = (): Record<string, any> => {
    const s = typeof window !== 'undefined' ? localStorage.getItem(USERS_KEY) : null;
    return s ? JSON.parse(s) : {};
};

// Helper: Save users to storage
const saveUsers = (users: Record<string, any>) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
};

// --- Mock Auth Object ---
export const auth = {
    get currentUser() {
        if (typeof window === 'undefined') return null;
        const u = localStorage.getItem(CURRENT_USER_KEY);
        return u ? JSON.parse(u) : null;
    },
    set currentUser(val: any) {
        if (typeof window === 'undefined') return;
        if (val) localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(val));
        else localStorage.removeItem(CURRENT_USER_KEY);
    }
};

// --- Mock Providers ---
export const googleProvider = { providerId: 'google.com' };
export const facebookProvider = { providerId: 'facebook.com' };

// Always return true so the UI doesn't show "Config Error"
export const isFirebaseConfigured = () => true;

// --- Mock Auth Functions ---

export const createUserWithEmailAndPassword = async (_auth: any, email: string, pass: string) => {
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
    
    const cleanEmail = email.toLowerCase().trim();
    const users = getUsers();
    
    if (users[cleanEmail]) {
        const err: any = new Error("Email already in use");
        err.code = 'auth/email-already-in-use';
        throw err;
    }

    // Replace deprecated substr with substring
    const uid = 'user_' + Math.random().toString(36).substring(2, 9);
    const newUser = {
        uid,
        email: cleanEmail,
        password: pass, // Stored locally for simulation
        emailVerified: false,
        displayName: cleanEmail.split('@')[0],
        photoURL: '',
        createdAt: Date.now()
    };

    users[cleanEmail] = newUser;
    saveUsers(users);

    return { user: newUser };
};

export const signInWithEmailAndPassword = async (_auth: any, email: string, pass: string) => {
    await new Promise(resolve => setTimeout(resolve, 600));

    const cleanEmail = email.toLowerCase().trim();
    const users = getUsers();
    const user = users[cleanEmail];

    if (!user) {
        const err: any = new Error("User not found");
        err.code = 'auth/user-not-found';
        throw err;
    }
    
    if (user.password !== pass) {
        const err: any = new Error("Wrong password");
        err.code = 'auth/wrong-password';
        throw err;
    }

    // In a real app, firebase auth doesn't block login for unverified emails by default, 
    // but our UI component checks `user.emailVerified`.
    // We return the user object as stored.
    
    return { user: { ...user } };
};

export const signOut = async (_auth: any) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    auth.currentUser = null;
};

export const sendEmailVerification = async (user: any) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`[Mock Email Service] Verification link sent to ${user.email}`);
    
    // SIMULATION: Automatically verify the user after a short delay to simulate them clicking the link
    // We will alert the user in the UI, but here we update the "backend" state.
    setTimeout(() => {
        const users = getUsers();
        const cleanEmail = user.email.toLowerCase().trim();
        if (users[cleanEmail]) {
            users[cleanEmail].emailVerified = true;
            saveUsers(users);
            // We verify the user in the backend, but the user needs to login again to refresh the token in a real app.
            console.log(`[Mock Email Service] ${cleanEmail} has been verified.`);
            alert(`(Mô phỏng) Hệ thống đã gửi email tới ${cleanEmail}.\n\nVì đây là bản demo, chúng tôi giả lập bạn đã bấm vào link xác thực.\n\nTài khoản của bạn ĐÃ ĐƯỢC KÍCH HOẠT! Bạn có thể đăng nhập ngay.`);
        }
    }, 2000);
};

export const signInWithPopup = async (_auth: any, provider: any) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const users = getUsers();
    // Generate a consistent dummy email for social login based on provider to allow re-login
    const providerName = provider.providerId === 'google.com' ? 'gmail' : 'facebook';
    const email = `demo_${providerName}_user@example.com`;
    const cleanEmail = email.toLowerCase().trim();
    
    let user = users[cleanEmail];
    if (!user) {
        user = {
            // Replace deprecated substr with substring
            uid: `social_${providerName}_` + Math.random().toString(36).substring(2, 9),
            email: cleanEmail,
            password: 'social-login-no-pass',
            emailVerified: true, // Social accounts are trusted
            displayName: provider.providerId === 'google.com' ? 'Google User' : 'Facebook User',
            photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanEmail}`,
            createdAt: Date.now()
        };
        users[cleanEmail] = user;
        saveUsers(users);
    }

    auth.currentUser = user;
    return { user };
};

export const updateProfile = async (user: any, updates: { displayName?: string; photoURL?: string }) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getUsers();
    const cleanEmail = user.email?.toLowerCase().trim();
    if (cleanEmail && users[cleanEmail]) {
        users[cleanEmail] = { ...users[cleanEmail], ...updates };
        saveUsers(users);
        auth.currentUser = users[cleanEmail];
    }
};

/**
 * Searches for users by email, display name, or UID.
 * Simulates a backend search query.
 */
export const searchUsers = async (query: string) => {
    await new Promise(resolve => setTimeout(resolve, 400)); // Simulate delay
    const users = getUsers();
    const lowerQuery = query.toLowerCase().trim();

    // STRICT: ONLY Return existing users, DO NOT create fake/seed users.
    // Filter logic: Check if query matches email, displayName or uid
    
    return Object.values(users)
        .filter((user: any) => 
            (user.email && user.email.toLowerCase().includes(lowerQuery)) ||
            (user.displayName && user.displayName.toLowerCase().includes(lowerQuery)) ||
            (user.uid && user.uid === query)
        )
        .map((user: any) => ({
            uid: user.uid,
            name: user.displayName || 'Unnamed User',
            email: user.email,
            avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`
        }));
};

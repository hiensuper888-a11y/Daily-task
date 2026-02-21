// SERVICES/FIREBASECONFIG.TS - MOCK IMPLEMENTATION
// This file simulates a Firebase Auth backend using localStorage.

const USERS_KEY = 'daily_task_mock_users';
const CURRENT_USER_KEY = 'daily_task_mock_current_user';

// Helper: Get all users from storage
const getUsers = (): Record<string, any> => {
    const s = typeof window !== 'undefined' ? localStorage.getItem(USERS_KEY) : null;
    let users = s ? JSON.parse(s) : {};
    
    // Ensure Admin User Exists
    if (!users['admin@dailytask.com']) {
        users['admin@dailytask.com'] = {
            uid: 'admin_001',
            email: 'admin@dailytask.com',
            password: '123456', // Hardcoded admin password as requested
            emailVerified: true,
            displayName: 'Administrator',
            photoURL: 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff',
            role: 'admin',
            createdAt: Date.now()
        };
        if (typeof window !== 'undefined') localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    
    return users;
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

    // Update last login
    user.lastLoginAt = Date.now();
    users[cleanEmail] = user;
    saveUsers(users);

    return { user: { ...user } };
};

export const signOut = async (_auth: any) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    auth.currentUser = null;
};

export const sendEmailVerification = async (user: any) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`[Mock Email Service] Verification link sent to ${user.email}`);
    
    setTimeout(() => {
        const users = getUsers();
        const cleanEmail = user.email.toLowerCase().trim();
        if (users[cleanEmail]) {
            users[cleanEmail].emailVerified = true;
            saveUsers(users);
            console.log(`[Mock Email Service] ${cleanEmail} has been verified.`);
            alert(`(Mô phỏng) Hệ thống đã gửi email tới ${cleanEmail}.\n\nVì đây là bản demo, chúng tôi giả lập bạn đã bấm vào link xác thực.\n\nTài khoản của bạn ĐÃ ĐƯỢC KÍCH HOẠT! Bạn có thể đăng nhập ngay.`);
        }
    }, 2000);
};

export const signInWithPopup = async (_auth: any, provider: any) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const users = getUsers();
    const providerName = provider.providerId === 'google.com' ? 'gmail' : 'facebook';
    const email = `demo_${providerName}_user@example.com`;
    const cleanEmail = email.toLowerCase().trim();
    
    let user = users[cleanEmail];
    if (!user) {
        user = {
            uid: `social_${providerName}_` + Math.random().toString(36).substring(2, 9),
            email: cleanEmail,
            password: 'social-login-no-pass',
            emailVerified: true, 
            displayName: provider.providerId === 'google.com' ? 'Google User' : 'Facebook User',
            photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanEmail}`,
            createdAt: Date.now()
        };
        users[cleanEmail] = user;
        saveUsers(users);
    }

    user.lastLoginAt = Date.now();
    users[cleanEmail] = user;
    saveUsers(users);

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

export const searchUsers = async (query: string) => {
    await new Promise(resolve => setTimeout(resolve, 400));
    const users = getUsers();
    const lowerQuery = query.toLowerCase().trim();
    
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

// --- ADMIN & ACCOUNT MANAGEMENT FUNCTIONS ---

export const getAllUsers = async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getUsers();
    return Object.values(users).map((u: any) => ({
        ...u,
        isOnline: (Date.now() - (u.lastLoginAt || 0)) < 5 * 60 * 1000 // Fake online status: active in last 5 mins
    }));
};

export const deleteUser = async (uid: string) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const users = getUsers();
    const emailToDelete = Object.keys(users).find(email => users[email].uid === uid);
    
    if (emailToDelete) {
        if (users[emailToDelete].role === 'admin') {
            throw new Error("Cannot delete admin account.");
        }
        delete users[emailToDelete];
        saveUsers(users);
        return true;
    }
    throw new Error("User not found.");
};

export const changePassword = async (uid: string, newPass: string) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const users = getUsers();
    const emailToUpdate = Object.keys(users).find(email => users[email].uid === uid);
    
    if (emailToUpdate) {
        users[emailToUpdate].password = newPass;
        saveUsers(users);
        return true;
    }
    throw new Error("User not found.");
};

export const deleteOwnAccount = async (uid: string) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const users = getUsers();
    const emailToDelete = Object.keys(users).find(email => users[email].uid === uid);
    
    if (emailToDelete) {
        if (users[emailToDelete].role === 'admin') {
            throw new Error("Cannot delete admin account.");
        }
        delete users[emailToDelete];
        saveUsers(users);
        return true;
    }
    throw new Error("User not found.");
};
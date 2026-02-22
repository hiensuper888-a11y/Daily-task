
import { supabase } from './supabaseClient';

// --- AUTH SERVICE (Supabase Implementation) ---


// Helper to map Supabase user to Firebase-like structure
const mapSupabaseUser = (user: any) => {
    if (!user) return null;
    return {
        uid: user.id,
        email: user.email,
        displayName: user.user_metadata?.display_name || user.email?.split('@')[0],
        photoURL: user.user_metadata?.avatar_url || '',
        emailVerified: !!user.email_confirmed_at,
        providerData: user.app_metadata?.provider ? [{ providerId: user.app_metadata.provider }] : []
    };
};

export const auth = supabase.auth;

export const getCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ? mapSupabaseUser(session.user) : null;
};


export const isFirebaseConfigured = () => true; // Supabase is configured

export const createUserWithEmailAndPassword = async (_auth: any, email: string, pass: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
            data: {
                display_name: email.split('@')[0],
                avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
            }
        }
    });

    if (error) throw error;
    
    // Map Supabase user to Firebase-like structure
    const user = data.user ? {
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.user_metadata?.display_name || email.split('@')[0],
        photoURL: data.user.user_metadata?.avatar_url || '',
        emailVerified: !!data.user.email_confirmed_at,
        providerData: data.user.app_metadata?.provider ? [{ providerId: data.user.app_metadata.provider }] : []
    } : null;

    return { user };
};

export const signInWithEmailAndPassword = async (_auth: any, email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
    });

    if (error) throw error;

    // Map Supabase user to Firebase-like structure
    const user = data.user ? {
        uid: data.user.id,
        email: data.user.email,
        displayName: data.user.user_metadata?.display_name || email.split('@')[0],
        photoURL: data.user.user_metadata?.avatar_url || '',
        emailVerified: !!data.user.email_confirmed_at,
        providerData: data.user.app_metadata?.provider ? [{ providerId: data.user.app_metadata.provider }] : []
    } : null;

    return { user };
};

export const signOut = async (_auth: any) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

export const sendEmailVerification = async (user: any) => {
    // Supabase sends verification email automatically on signUp if configured.
    // We can trigger a resend if needed, but for now we'll just log.
    console.log("Verification email sent by Supabase (if enabled).");
};


export const updateProfile = async (user: any, updates: { displayName?: string; photoURL?: string }) => {
    const { data, error } = await supabase.auth.updateUser({
        data: {
            display_name: updates.displayName,
            avatar_url: updates.photoURL
        }
    });

    if (error) throw error;
    // Update local user object if needed, but the auth listener should handle it
};

export const changePassword = async (uid: string, newPass: string) => {
    const { data, error } = await supabase.auth.updateUser({
        password: newPass
    });

    if (error) throw error;
    return true;
};

// --- ADMIN / DANGEROUS FUNCTIONS (Mocked or Limited) ---

export const deleteOwnAccount = async (uid: string) => {
    // Supabase client cannot delete users. Requires Admin API.
    console.warn("deleteOwnAccount: Not supported on client side with Supabase.");
    throw new Error("Please contact support to delete your account.");
};

export const getAllUsers = async () => {
    // Cannot list users from client.
    console.warn("getAllUsers: Not supported on client side. Returning mock data.");
    // Return a mock list or just the current user if we could get it
    return [
        { 
            uid: 'mock_admin', 
            email: 'admin@example.com', 
            displayName: 'Admin (Mock)', 
            role: 'admin', 
            isOnline: true, 
            createdAt: Date.now() 
        }
    ];
};

export const deleteUser = async (uid: string) => {
    console.warn("deleteUser: Not supported on client side.");
    throw new Error("Admin privileges required (Backend only).");
};

export const adminCreateUser = async (userData: { email: string; pass: string; displayName: string; role?: string }) => {
    console.warn("adminCreateUser: Not supported on client side.");
    throw new Error("Admin privileges required (Backend only).");
};

export const searchUsers = async (query: string) => {
    // For now, return a mock result or empty array to prevent crash
    console.warn("User search is not fully implemented with Supabase yet (requires 'profiles' table). Returning mock data.");
    
    // Simulate a delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return some dummy users for testing UI
    return [
        { uid: 'mock_1', name: 'Alice (Mock)', email: 'alice@example.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice' },
        { uid: 'mock_2', name: 'Bob (Mock)', email: 'bob@example.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob' }
    ].filter(u => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.includes(query.toLowerCase()));
};

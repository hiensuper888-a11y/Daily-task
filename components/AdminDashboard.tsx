import React, { useState, useEffect } from 'react';
import { Users, Trash2, Search, RefreshCw, Shield, Activity, Clock, UserX, Eye, LogIn, X, CheckCircle2, Circle, Calendar as CalendarIcon, Mail, Phone, MapPin, Briefcase, Plus, Key, Save, UserPlus } from 'lucide-react';
import { getAllUsers, deleteUser, adminCreateUser, changePassword } from '../services/authService';
import { useLanguage } from '../contexts/LanguageContext';
import { SESSION_KEY } from '../hooks/useRealtimeStorage';
import { Task } from '../types';

export const AdminDashboard: React.FC = () => {
    const { t } = useLanguage();
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ total: 0, online: 0 });
    
    // Detail Modal State
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [userTasks, setUserTasks] = useState<Task[]>([]);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');

    // Create User Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        email: '',
        password: '',
        displayName: '',
        role: 'member'
    });
    const [isCreating, setIsCreating] = useState(false);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await getAllUsers();
            setUsers(data);
            setStats({
                total: data.length,
                online: data.filter((u: any) => u.isOnline).length
            });
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        const interval = setInterval(fetchUsers, 30000); // Auto refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const handleDeleteUser = async (uid: string, email: string) => {
        if (confirm(t.deleteUserConfirm.replace('{email}', email))) {
            try {
                await deleteUser(uid);
                setUsers(prev => prev.filter(u => u.uid !== uid));
                setStats(prev => ({ ...prev, total: prev.total - 1 }));
                alert(t.userDeleted);
            } catch (error: any) {
                alert(t.errorPrefix + error.message);
            }
        }
    };

    const handleImpersonate = (uid: string) => {
        if (confirm(`Do you want to login as this user? You will need to refresh to return to Admin.`)) {
            localStorage.setItem(SESSION_KEY, uid);
            window.location.reload();
        }
    };

    const handleViewDetails = (user: any) => {
        setSelectedUser(user);
        setIsUpdatingPassword(false);
        setNewPassword('');
        // Fetch user's tasks from localStorage
        const taskKey = `${user.uid}_daily_tasks`;
        const storedTasks = localStorage.getItem(taskKey);
        if (storedTasks) {
            try {
                setUserTasks(JSON.parse(storedTasks));
            } catch (e) {
                setUserTasks([]);
            }
        } else {
            setUserTasks([]);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!createFormData.email || !createFormData.password || !createFormData.displayName) {
            alert("Please fill all fields");
            return;
        }
        setIsCreating(true);
        try {
            await adminCreateUser({
                email: createFormData.email,
                pass: createFormData.password,
                displayName: createFormData.displayName,
                role: createFormData.role
            });
            alert("User created successfully!");
            setShowCreateModal(false);
            setCreateFormData({ email: '', password: '', displayName: '', role: 'member' });
            fetchUsers();
        } catch (error: any) {
            alert("Error: " + error.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            alert("Password must be at least 6 characters");
            return;
        }
        try {
            await changePassword(selectedUser.uid, newPassword);
            alert("Password updated successfully!");
            setSelectedUser({ ...selectedUser, password: newPassword });
            setIsUpdatingPassword(false);
            setNewPassword('');
            fetchUsers();
        } catch (error: any) {
            alert("Error: " + error.message);
        }
    };

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full max-w-6xl mx-auto p-6 pb-32 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <Shield size={32} className="text-indigo-600 dark:text-indigo-400"/> {t.adminDashboard}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">{t.manageUsers}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 transition-all active:scale-95"
                    >
                        <Plus size={18}/> {t.add || 'Add User'}
                    </button>
                    <button onClick={fetchUsers} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 shadow-sm transition-all active:scale-95">
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""}/> {t.reset}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Users size={28} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.totalUsers}</p>
                        <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Activity size={28} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.onlineNow}</p>
                        <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.online}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Clock size={28} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.systemStatus}</p>
                        <p className="text-lg font-black text-slate-800 dark:text-slate-100">{t.operational}</p>
                    </div>
                </div>
            </div>

            {/* User Management */}
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700/50 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t.userManagement}</h2>
                    <div className="relative w-full md:w-auto">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"/>
                        <input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t.searchUsers} 
                            className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700/50">
                                <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.user}</th>
                                <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.role}</th>
                                <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.status}</th>
                                <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.assignedDate}</th>
                                <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">{t.actions}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium">{t.syncing}</td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium">{t.emptyTasks}</td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.uid} className="border-b border-slate-50 dark:border-slate-700/30 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 object-cover" alt=""/>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{user.displayName || 'Unknown'}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${user.role === 'admin' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                                                {user.role === 'admin' ? 'Admin' : t.member}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                <span className={`text-xs font-bold ${user.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                    {user.isOnline ? t.online : 'Offline'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleViewDetails(user)}
                                                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                                                    title="View Details"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                {user.role !== 'admin' && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleImpersonate(user.uid)}
                                                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                                                            title="Login as User"
                                                        >
                                                            <LogIn size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteUser(user.uid, user.email)}
                                                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                                                            title={t.delete}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* USER DETAIL MODAL */}
            {selectedUser && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] shadow-2xl animate-scale-in flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
                            <div className="flex items-center gap-4">
                                <img src={selectedUser.photoURL || `https://ui-avatars.com/api/?name=${selectedUser.displayName}`} className="w-12 h-12 rounded-2xl object-cover shadow-sm" alt=""/>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{selectedUser.displayName}</h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                <X size={20}/>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-slate-900/30 custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Column: Info */}
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Account Info</h3>
                                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                            <Mail size={16} className="text-slate-400 dark:text-slate-500"/>
                                            <span className="truncate">{selectedUser.email}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                            <CalendarIcon size={16} className="text-slate-400 dark:text-slate-500"/>
                                            <span>Joined: {new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                            <Activity size={16} className="text-slate-400 dark:text-slate-500"/>
                                            <span>Last Login: {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : 'Never'}</span>
                                        </div>
                                        
                                        <div className="pt-4 border-t border-slate-50 dark:border-slate-700/30 space-y-3">
                                            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Security</h3>
                                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Password</span>
                                                    <button 
                                                        onClick={() => setIsUpdatingPassword(!isUpdatingPassword)}
                                                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                                    >
                                                        {isUpdatingPassword ? 'Cancel' : 'Change'}
                                                    </button>
                                                </div>
                                                {isUpdatingPassword ? (
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text"
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                            placeholder="New password"
                                                            className="flex-1 px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                        <button 
                                                            onClick={handleUpdatePassword}
                                                            className="p-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                                        >
                                                            <Save size={14}/>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-sm font-mono text-slate-700 dark:text-slate-200">
                                                        <Key size={14} className="text-slate-400"/>
                                                        <span>{selectedUser.password}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-50 dark:border-slate-700/30">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${selectedUser.isOnline ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                                {selectedUser.isOnline ? 'Online Now' : 'Offline'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-4">
                                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Personal Details</h3>
                                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                            <Phone size={16} className="text-slate-400 dark:text-slate-500"/>
                                            <span>{selectedUser.phoneNumber || 'Not provided'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                            <MapPin size={16} className="text-slate-400 dark:text-slate-500"/>
                                            <span>{selectedUser.address || 'No address'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                            <Briefcase size={16} className="text-slate-400 dark:text-slate-500"/>
                                            <span>{selectedUser.jobTitle || 'No job title'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Tasks */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm min-h-[400px]">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Personal Tasks ({userTasks.length})</h3>
                                            <div className="flex gap-2">
                                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-lg">
                                                    {userTasks.filter(t => t.completed).length} Done
                                                </span>
                                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg">
                                                    {userTasks.filter(t => !t.completed).length} Pending
                                                </span>
                                            </div>
                                        </div>

                                        {userTasks.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500">
                                                <Circle size={48} className="mb-4 opacity-20"/>
                                                <p className="font-medium">No tasks found for this user.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {userTasks.map(task => (
                                                    <div key={task.id} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-700/50 group transition-all">
                                                        {task.completed ? (
                                                            <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                                                        ) : (
                                                            <Circle size={20} className="text-slate-300 dark:text-slate-600 shrink-0" />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-bold truncate ${task.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                {task.text}
                                                            </p>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                                    Created: {new Date(task.createdAt).toLocaleDateString()}
                                                                </span>
                                                                {task.deadline && (
                                                                    <span className="text-[10px] text-rose-400 dark:text-rose-500 font-bold">
                                                                        Due: {new Date(task.deadline).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {task.priority && (
                                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                                task.priority === 'high' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' :
                                                                task.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' :
                                                                'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                                            }`}>
                                                                {task.priority}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 flex justify-end gap-3">
                            <button onClick={() => setSelectedUser(null)} className="px-6 py-2.5 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                Close
                            </button>
                            <button onClick={() => handleImpersonate(selectedUser.uid)} className="px-6 py-2.5 bg-indigo-600 dark:bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:bg-indigo-700 dark:hover:bg-indigo-500 active:scale-95 transition-all flex items-center gap-2">
                                <LogIn size={18}/> Login as {selectedUser.displayName.split(' ')[0]}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE USER MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-md shadow-2xl animate-scale-in overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <UserPlus size={24} className="text-indigo-600"/> Add New User
                            </h2>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                <X size={20}/>
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Full Name</label>
                                <input 
                                    required
                                    type="text"
                                    value={createFormData.displayName}
                                    onChange={(e) => setCreateFormData({...createFormData, displayName: e.target.value})}
                                    placeholder="John Doe"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Email Address</label>
                                <input 
                                    required
                                    type="email"
                                    value={createFormData.email}
                                    onChange={(e) => setCreateFormData({...createFormData, email: e.target.value})}
                                    placeholder="user@example.com"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Password</label>
                                <input 
                                    required
                                    type="text"
                                    value={createFormData.password}
                                    onChange={(e) => setCreateFormData({...createFormData, password: e.target.value})}
                                    placeholder="Min 6 characters"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Role</label>
                                <select 
                                    value={createFormData.role}
                                    onChange={(e) => setCreateFormData({...createFormData, role: e.target.value})}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 appearance-none"
                                >
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 px-6 py-2.5 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isCreating}
                                    className="flex-1 px-6 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isCreating ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

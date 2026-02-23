import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, CheckCircle2, Circle, AlertCircle, Filter, Download } from 'lucide-react';
import { Task } from '../types';

interface UserStatisticsProps {
    userId: string;
    userName: string;
    onClose: () => void;
}

export const UserStatistics: React.FC<UserStatisticsProps> = ({ userId, userName, onClose }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toLocaleDateString('en-CA'), // Last 7 days
        end: new Date().toLocaleDateString('en-CA')
    });

    useEffect(() => {
        fetchTasks();
        
        // Real-time subscription
        const channel = supabase
            .channel('public:tasks')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` }, (payload) => {
                fetchTasks(); // Refresh on change
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, dateRange]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId);
            
            // Apply Date Filter (created_at)
            if (dateRange.start) {
                query = query.gte('created_at', `${dateRange.start}T00:00:00`);
            }
            if (dateRange.end) {
                query = query.lte('created_at', `${dateRange.end}T23:59:59`);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data) {
                // Map raw_data back to Task or use columns
                const mappedTasks: Task[] = data.map((t: any) => ({
                    ...t.raw_data, // Use raw_data as source of truth for complex fields
                    id: t.id,
                    text: t.text,
                    completed: t.completed,
                    createdAt: t.created_at,
                    deadline: t.deadline,
                    priority: t.priority
                }));
                setTasks(mappedTasks);
            }
        } catch (error) {
            console.error("Error fetching user tasks:", error);
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const byPriority = {
            high: tasks.filter(t => t.priority === 'high').length,
            medium: tasks.filter(t => t.priority === 'medium').length,
            low: tasks.filter(t => t.priority === 'low').length,
        };

        return { total, completed, pending, rate, byPriority };
    }, [tasks]);

    const chartData = useMemo(() => {
        const grouped: Record<string, { date: string; completed: number; pending: number }> = {};
        
        tasks.forEach(t => {
            const date = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!grouped[date]) grouped[date] = { date, completed: 0, pending: 0 };
            if (t.completed) grouped[date].completed++;
            else grouped[date].pending++;
        });

        return Object.values(grouped).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [tasks]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-5xl h-[90vh] shadow-2xl animate-scale-in flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <AlertCircle size={28} className="text-indigo-600"/> Task Statistics
                        </h2>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">User: <span className="text-indigo-600 dark:text-indigo-400">{userName}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                        <Filter size={20} className="rotate-45"/> {/* Close Icon substitute */}
                    </button>
                </div>

                {/* Filters */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-slate-400"/>
                        <span className="text-xs font-bold uppercase text-slate-500">Date Range:</span>
                    </div>
                    <input 
                        type="date" 
                        value={dateRange.start} 
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-slate-400">-</span>
                    <input 
                        type="date" 
                        value={dateRange.end} 
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button onClick={fetchTasks} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                        Apply Filter
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/20">
                    
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Tasks</p>
                            <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{stats.total}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Completed</p>
                            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Pending</p>
                            <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{stats.pending}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Completion Rate</p>
                            <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{stats.rate}%</p>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 h-[300px]">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Tasks Over Time</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false}/>
                                    <XAxis dataKey="date" tick={{fontSize: 10}} axisLine={false} tickLine={false}/>
                                    <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false}/>
                                    <Tooltip 
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                                        cursor={{fill: '#f1f5f9'}}
                                    />
                                    <Legend />
                                    <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                                    <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 h-[300px]">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Tasks by Priority</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'High', value: stats.byPriority.high },
                                            { name: 'Medium', value: stats.byPriority.medium },
                                            { name: 'Low', value: stats.byPriority.low },
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        <Cell key="high" fill="#f43f5e" />
                                        <Cell key="medium" fill="#f59e0b" />
                                        <Cell key="low" fill="#10b981" />
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Task List Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Detailed Task List</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Task</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {tasks.map(task => (
                                        <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                {task.completed ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold">
                                                        <CheckCircle2 size={12}/> Done
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-xs font-bold">
                                                        <Circle size={12}/> Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-xs">{task.text}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs font-bold capitalize ${
                                                    task.priority === 'high' ? 'text-rose-500' : 
                                                    task.priority === 'medium' ? 'text-amber-500' : 'text-emerald-500'
                                                }`}>
                                                    {task.priority || 'medium'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-slate-500">
                                                    {new Date(task.createdAt).toLocaleDateString()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {tasks.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm font-bold">
                                                No tasks found for this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};


export interface Subtask {
  id: number;
  text: string;
  completed: boolean;
}

export type Priority = 'low' | 'medium' | 'high';

export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'file';
  name: string;
  url: string; // Base64 or URL
  size?: number;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: number;
  role?: 'leader' | 'member';
}

export interface Task {
  id: number;
  text: string;
  completed: boolean;
  progress: number;
  createdAt: string; // Used as "Assigned Date"
  completedAt?: string; // Exact time when task was marked as done
  deadline?: string; // ISO String for Deadline
  estimatedTime?: number; // In minutes
  archived?: boolean;
  subtasks?: Subtask[]; // Added subtasks support
  priority?: Priority;
  
  // Group features
  groupId?: string;
  assignedTo?: string; // userId (email or uid)
  completedBy?: string; // userId of who finished it
  completionNote?: string; // Note added when finishing
  createdBy?: string; // User ID of creator
  
  // Leader Evaluation
  leaderFeedback?: string; // Comment from leader
  leaderRating?: number; // 1-5 stars or similar
  
  // New features
  attachments?: Attachment[];
  comments?: Comment[];
}

export interface GroupMember {
  id: string; // email or uid
  name: string;
  avatar: string;
  role: 'leader' | 'member';
  joinedAt: number;
  // New features for member management
  customTitle?: string; // Chức danh (VD: Designer, Developer)
  note?: string;        // Ghi chú công việc
  headerBackground?: string; // Custom header background (CSS value: url or linear-gradient)
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  leaderId: string;
  avatar?: string; // Group Avatar URL/Base64
  background?: string; // Group Shared Cover URL/Base64 (CSS value: url(...))
  members: GroupMember[];
  joinCode: string; // Simple code for manual joining
  createdAt: number;
}

export type FilterType = 'all' | 'active' | 'completed' | 'assigned_to_me' | 'delegated' | 'archived';

export type AppTab = 'tasks' | 'calendar' | 'studio' | 'reports' | 'profile' | 'ai' | 'admin';

export type Language = 'vi' | 'en' | 'zh' | 'ja' | 'de' | 'fr' | 'es';

export type SortOption = 'manual' | 'priority' | 'date_new' | 'date_old' | 'deadline';

export interface UserProfile {
  uid?: string; // Unique ID from Firebase
  name: string;
  email: string;
  avatar: string;
  provider: 'google' | 'facebook' | 'email' | null;
  isLoggedIn: boolean;
  birthYear?: string;
  hometown?: string;
  address?: string;
  company?: string;
  phoneNumber?: string;
  // New fields
  jobTitle?: string;   // Chức vụ
  department?: string; // Bộ phận
}

export interface DailyReflection {
  evaluation: string;
  improvement: string;
}

export type ReflectionMap = Record<string, DailyReflection>;

export type AiModel = 'gemini' | 'chatgpt' | 'grok';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  modelUsed?: AiModel;
}
export interface Subtask {
  id: number;
  text: string;
  completed: boolean;
}

export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: number;
  text: string;
  completed: boolean;
  progress: number;
  createdAt: string;
  archived?: boolean;
  subtasks?: Subtask[];
  priority?: Priority;
}

export type FilterType = 'all' | 'active' | 'completed';

export type AppTab = 'tasks' | 'studio' | 'reports' | 'profile' | 'ai';

export type Language = 'vi' | 'en' | 'zh' | 'ja' | 'fr' | 'ko' | 'de' | 'es' | 'ru' | 'hi';

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  provider: 'google' | 'facebook' | null;
  isLoggedIn: boolean;
  birthYear?: string;
  hometown?: string;
  address?: string;
  company?: string;
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
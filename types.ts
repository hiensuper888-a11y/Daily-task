export interface Task {
  id: number;
  text: string;
  completed: boolean;
  progress: number;
  createdAt: string;
}

export type FilterType = 'all' | 'active' | 'completed';

export type AppTab = 'tasks' | 'studio';
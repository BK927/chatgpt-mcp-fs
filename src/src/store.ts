import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';

export interface ServerStatus {
  running: boolean;
  port: number;
  pid?: number;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface AppConfig {
  port: number;
  allowed_folders: string[];
  auto_start: boolean;
  ngrok_enabled: boolean;
}

interface AppState {
  // Server state
  serverStatus: ServerStatus;
  logs: LogEntry[];

  // Config state
  config: AppConfig;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setServerStatus: (status: ServerStatus) => void;
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  setConfig: (config: AppConfig) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  serverStatus: {
    running: false,
    port: 3000,
  },
  logs: [],
  config: {
    port: 3000,
    allowed_folders: [],
    auto_start: false,
    ngrok_enabled: false,
  },
  isLoading: false,
  error: null,

  // Actions
  setServerStatus: (status) => set({ serverStatus: status }),
  addLog: (log) => set((state) => ({ logs: [...state.logs, log].slice(-500) })),
  clearLogs: () => set({ logs: [] }),
  setConfig: (config) => set({ config }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

// Initialize event listeners
export async function initializeEventListeners() {
  // Listen for server status updates
  await listen<ServerStatus>('server:status', (event) => {
    useAppStore.getState().setServerStatus(event.payload);
  });

  // Listen for server logs
  await listen<LogEntry>('server:log', (event) => {
    useAppStore.getState().addLog(event.payload);
  });
}

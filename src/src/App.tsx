import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore, initializeEventListeners } from './store';
import ServerStatus from './components/ServerStatus';
import FolderList from './components/FolderList';
import LogViewer from './components/LogViewer';
import CredentialsCard from './components/CredentialsCard';
import { Settings, FolderOpen, Terminal } from 'lucide-react';

function App() {
  const { config, setConfig, setLoading, setError } = useAppStore();

  useEffect(() => {
    // Initialize event listeners
    initializeEventListeners();

    // Load initial config
    loadConfig();
  }, []);

  // Save config to backend whenever it changes
  const saveConfig = useCallback(async (newConfig: typeof config) => {
    try {
      await invoke('save_config', { config: newConfig });
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  }, []);

  // Update config and save to disk
  const updateConfig = useCallback((updates: Partial<typeof config>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveConfig(newConfig);
  }, [config, setConfig, saveConfig]);

  async function loadConfig() {
    try {
      setLoading(true);
      const loadedConfig = await invoke<{ port: number; allowed_folders: string[]; auto_start: boolean; ngrok_enabled: boolean; ngrok_url: string | null }>('get_config');
      setConfig({
        ...loadedConfig,
        ngrok_url: loadedConfig.ngrok_url || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">ChatGPT MCP File System</h1>
              <p className="text-sm text-gray-500">Manage your local file access for ChatGPT</p>
            </div>
          </div>
          <ServerStatus />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Folders */}
          <div className="lg:col-span-2">
            <FolderList />
          </div>

          {/* Right Column - Settings & Logs */}
          <div className="space-y-6">
            {/* Settings Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                <h2 className="font-medium text-gray-900">Settings</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Server Port
                  </label>
                  <input
                    type="number"
                    value={config.port}
                    onChange={(e) => updateConfig({ port: parseInt(e.target.value, 10) || 3000 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min={1024}
                    max={65535}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Auto-start on launch</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.auto_start}
                      onChange={(e) => updateConfig({ auto_start: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Enable Ngrok tunnel (auto)</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.ngrok_enabled}
                      onChange={(e) => updateConfig({ ngrok_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {config.ngrok_enabled && (
                  <p className="text-xs text-gray-500">
                    Ngrok will start automatically when server starts. Make sure ngrok is installed and in PATH.
                  </p>
                )}
              </div>
            </div>

            {/* OAuth Credentials Card */}
            <CredentialsCard />

            {/* Logs Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-gray-500" />
                <h2 className="font-medium text-gray-900">Server Logs</h2>
              </div>
              <LogViewer />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;

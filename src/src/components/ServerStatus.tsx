import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store';
import { Play, Square, Loader2 } from 'lucide-react';

export default function ServerStatus() {
  const { serverStatus, config, isLoading, setLoading, setError, addLog } = useAppStore();

  async function handleStartServer() {
    try {
      setLoading(true);
      setError(null);

      // Pass issuer URL if ngrok is enabled and URL is set
      const issuerUrl = config.ngrok_enabled && config.ngrok_url ? config.ngrok_url : null;

      await invoke('start_server', {
        port: config.port,
        issuerUrl: issuerUrl
      });
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Starting server on port ${config.port}${issuerUrl ? ` with issuer ${issuerUrl}` : ''}...`,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleStopServer() {
    try {
      setLoading(true);
      setError(null);
      await invoke('stop_server');
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Stopping server...',
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            serverStatus.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`}
        />
        <span className="text-sm text-gray-600">
          {serverStatus.running ? `Running on port ${serverStatus.port}` : 'Stopped'}
        </span>
      </div>

      {/* Start/Stop Button */}
      {serverStatus.running ? (
        <button
          onClick={handleStopServer}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          Stop
        </button>
      ) : (
        <button
          onClick={handleStartServer}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Start
        </button>
      )}
    </div>
  );
}

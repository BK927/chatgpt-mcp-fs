import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { Trash2 } from 'lucide-react';

export default function LogViewer() {
  const { logs, clearLogs } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  function getLevelColor(level: string): string {
    switch (level) {
      case 'error':
        return 'text-red-600';
      case 'warn':
        return 'text-yellow-600';
      case 'debug':
        return 'text-gray-400';
      default:
        return 'text-gray-600';
    }
  }

  function formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  }

  return (
    <div className="flex flex-col h-64">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-end">
        <button
          onClick={clearLogs}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          title="Clear logs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      {/* Log Entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-xs bg-gray-900"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            No logs yet
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className="flex items-start gap-2 py-0.5 hover:bg-gray-800/50 px-1 rounded"
            >
              <span className="text-gray-500 flex-shrink-0">
                [{formatTimestamp(log.timestamp)}]
              </span>
              <span
                className={`flex-shrink-0 uppercase font-medium ${getLevelColor(log.level)}`}
              >
                [{log.level}]
              </span>
              <span className="text-gray-300 break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

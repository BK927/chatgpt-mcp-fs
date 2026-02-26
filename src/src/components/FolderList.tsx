import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store';
import { FolderPlus, Trash2, FolderOpen, Check, AlertCircle } from 'lucide-react';

export default function FolderList() {
  const { config, setConfig } = useAppStore();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddFolder() {
    try {
      setIsValidating(true);
      setError(null);

      const folder = await invoke<string | null>('pick_folder');

      if (folder && !config.allowed_folders.includes(folder)) {
        const newFolders = [...config.allowed_folders, folder];
        const newConfig = { ...config, allowed_folders: newFolders };
        setConfig(newConfig);
        await invoke('save_config', { config: newConfig });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsValidating(false);
    }
  }

  async function handleRemoveFolder(folder: string) {
    const newFolders = config.allowed_folders.filter((f) => f !== folder);
    const newConfig = { ...config, allowed_folders: newFolders };
    setConfig(newConfig);
    await invoke('save_config', { config: newConfig });
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-gray-500" />
          <h2 className="font-medium text-gray-900">Allowed Folders</h2>
          <span className="text-sm text-gray-500">({config.allowed_folders.length})</span>
        </div>
        <button
          onClick={handleAddFolder}
          disabled={isValidating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          Add Folder
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Folder List */}
      <div className="divide-y divide-gray-100">
        {config.allowed_folders.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No folders configured</p>
            <p className="text-gray-400 text-xs mt-1">
              Add folders that ChatGPT can access
            </p>
          </div>
        ) : (
          config.allowed_folders.map((folder) => (
            <div
              key={folder}
              className="px-4 py-3 flex items-center justify-between group hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FolderOpen className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <span className="text-sm text-gray-700 truncate font-mono" title={folder}>
                  {folder}
                </span>
              </div>
              <button
                onClick={() => handleRemoveFolder(folder)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="Remove folder"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Help Text */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          <Check className="w-3 h-3 inline-block mr-1" />
          Only files within these folders will be accessible to ChatGPT
        </p>
      </div>
    </div>
  );
}

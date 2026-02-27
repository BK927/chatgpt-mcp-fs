import { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { Copy, Check, Key, Loader2 } from 'lucide-react';

interface Credentials {
  client_id: string;
  client_secret: string;
  issuer_url: string;
  sse_endpoint: string;
}

export default function CredentialsCard() {
  const { serverStatus, config } = useAppStore();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (serverStatus.running) {
      fetchCredentials();
    } else {
      setCredentials(null);
    }
  }, [serverStatus.running, config.port]);

  async function fetchCredentials() {
    setLoading(true);
    try {
      // Retry a few times in case server is still starting (총 15초 대기)
      for (let i = 0; i < 15; i++) {
        try {
          const response = await fetch(`http://localhost:${config.port}/credentials`);
          if (response.ok) {
            const data = await response.json();
            // If ngrok is running, use the ngrok URL
            if (serverStatus.ngrok_url) {
              data.sse_endpoint = `${serverStatus.ngrok_url}/sse`;
              data.issuer_url = serverStatus.ngrok_url;
            }
            setCredentials(data);
            setLoading(false);
            return;
          }
        } catch {
          // Wait and retry (1초 대기)
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (err) {
      console.error('Failed to fetch credentials:', err);
    }
    setLoading(false);
  }

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!serverStatus.running) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <Key className="w-4 h-4 text-gray-500" />
        <h2 className="font-medium text-gray-900">OAuth Credentials</h2>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-500 mb-3">
          Use these credentials to connect ChatGPT to this server.
          {serverStatus.ngrok_url && (
            <span className="block mt-1 text-green-600">
              Ngrok URL: {serverStatus.ngrok_url}
            </span>
          )}
        </p>

        {credentials ? (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">SSE Endpoint</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2 py-1 bg-gray-100 rounded text-sm text-gray-800 break-all">
                  {credentials.sse_endpoint}
                </code>
                <button
                  onClick={() => copyToClipboard(credentials.sse_endpoint, 'endpoint')}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="Copy"
                >
                  {copied === 'endpoint' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Client ID</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2 py-1 bg-gray-100 rounded text-sm text-gray-800 break-all">
                  {credentials.client_id}
                </code>
                <button
                  onClick={() => copyToClipboard(credentials.client_id, 'id')}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="Copy"
                >
                  {copied === 'id' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Client Secret</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2 py-1 bg-gray-100 rounded text-sm text-gray-800 break-all">
                  {credentials.client_secret}
                </code>
                <button
                  onClick={() => copyToClipboard(credentials.client_secret, 'secret')}
                  className="p-1 hover:bg-gray-100 rounded"
                  title="Copy"
                >
                  {copied === 'secret' ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Loading credentials...</p>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

function App() {
  const [apiHealth, setApiHealth] = useState<{
    status: string;
    timestamp: string;
    uptime: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/v1';

    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => setApiHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Astrosetta
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Natal chart and transit learning application
          </p>
        </header>

        <main className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
              System Status
            </h2>

            {error && (
              <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
                <p className="font-bold">API Connection Error</p>
                <p className="text-sm">{error}</p>
                <p className="text-xs mt-2">
                  Make sure the API is running at: {import.meta.env.VITE_API_URL || 'http://localhost:3000/v1'}
                </p>
              </div>
            )}

            {apiHealth && (
              <div className="bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-200 px-4 py-3 rounded">
                <p className="font-bold">✓ API Connected</p>
                <div className="text-sm mt-2 space-y-1">
                  <p>Status: <span className="font-mono">{apiHealth.status}</span></p>
                  <p>Uptime: <span className="font-mono">{Math.floor(apiHealth.uptime)}s</span></p>
                  <p>Timestamp: <span className="font-mono text-xs">{apiHealth.timestamp}</span></p>
                </div>
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                Milestones
              </h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  M0: Scaffold (monorepo, API, web, database schema)
                </li>
                <li className="flex items-center text-gray-400">
                  <span className="mr-2">○</span>
                  M1: Chart Engine
                </li>
                <li className="flex items-center text-gray-400">
                  <span className="mr-2">○</span>
                  M2: Natal MVP
                </li>
                <li className="flex items-center text-gray-400">
                  <span className="mr-2">○</span>
                  M3: Transits
                </li>
                <li className="flex items-center text-gray-400">
                  <span className="mr-2">○</span>
                  M4: Learning
                </li>
                <li className="flex items-center text-gray-400">
                  <span className="mr-2">○</span>
                  M5: Retention & Polish
                </li>
                <li className="flex items-center text-gray-400">
                  <span className="mr-2">○</span>
                  M6: Native Wrap
                </li>
              </ul>
            </div>
          </div>
        </main>

        <footer className="text-center mt-12 text-gray-600 dark:text-gray-400">
          <p className="text-sm">
            Built with Vite + React + TypeScript + Tailwind CSS
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;

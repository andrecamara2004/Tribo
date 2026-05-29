import { useEffect, useState } from 'react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://tribo-497810.ew.r.appspot.com';

type HealthResponse = { status: string };

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/rest/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Tribo Web</h1>
      <p>API base: <code>{API_BASE_URL}</code></p>
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {health && <p style={{ color: 'green' }}>API status: <strong>{health.status}</strong></p>}
      {!health && !error && <p>Loading…</p>}
    </div>
  );
}

export default App;
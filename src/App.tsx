import { useState } from 'react';
import { Login } from './components/Login';
import { Messenger } from './components/Messenger';
import type { Credentials } from './types';

export default function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  if (!credentials) return <Login onConnect={setCredentials} />;
  return <Messenger credentials={credentials} onLogout={() => setCredentials(null)} />;
}

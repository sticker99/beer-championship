'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;
    setIsJoining(true);
    router.push(`/tasting/${code.toUpperCase()}?name=${encodeURIComponent(name)}`);
  };

  return (
    <main className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', maxWidth: '420px', width: '100%' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🍻</div>
        
        <h1 className="title-display" style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', marginBottom: '8px' }}>
          Join the Party
        </h1>
        
        <p className="title-marker" style={{ color: 'var(--neon-pink)', fontSize: '1.1rem', marginBottom: '24px' }}>
          Ready to taste some brews? 🤤
        </p>

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
              👤 Your Name
            </label>
            <input 
              className="input-field"
              placeholder="e.g. Beer Baron Bob"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700 }}>
              🔑 Session Code
            </label>
            <input 
              className="input-field"
              placeholder="e.g. A1B2"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={4}
              style={{ textTransform: 'uppercase', letterSpacing: '8px', fontFamily: 'var(--font-display)', fontSize: '1.5rem', textAlign: 'center' }}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', fontSize: '1.2rem' }} disabled={isJoining}>
            {isJoining ? '🔄 Joining...' : '🍺 Let\'s Go!'}
          </button>
        </form>
      </div>
    </main>
  );
}

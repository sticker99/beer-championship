'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminSuccessPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Confetti effect
  const [confetti, setConfetti] = useState<Array<{ left: number; color: string; delay: number; duration: number }>>([]);
  
  useEffect(() => {
    const pieces = Array.from({ length: 50 }).map(() => ({
      left: Math.random() * 100,
      color: ['#fbbf24', '#f472b6', '#38bdf8', '#4ade80', '#f59e0b', '#a78bfa'][Math.floor(Math.random() * 6)],
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
    }));
    setConfetti(pieces);
  }, []);

  return (
    <>
      {/* Confetti */}
      {confetti.map((piece, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            width: `${6 + Math.random() * 8}px`,
            height: `${6 + Math.random() * 8}px`,
          }}
        />
      ))}

      <main className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="glass-panel animate-bounce-in" style={{ textAlign: 'center', maxWidth: '600px', width: '100%' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉🍺🎉</div>
          
          <h1 className="title-display" style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', marginBottom: '8px' }}>
            Session Created!
          </h1>
          
          <p className="title-marker" style={{ color: 'var(--neon-green)', fontSize: '1.2rem', marginBottom: '24px' }}>
            Time to get the party started!
          </p>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Share this code with your crew so they can join in on the tasting fun!
          </p>

          <div 
            onClick={copyCode}
            style={{ 
              background: 'rgba(0,0,0,0.4)', 
              padding: '28px', 
              borderRadius: '20px', 
              marginBottom: '16px', 
              cursor: 'pointer',
              border: '2px dashed rgba(245, 158, 11, 0.3)',
              transition: 'all 0.3s ease'
            }}
          >
            <div className="neon-text" style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', fontFamily: 'var(--font-display)', letterSpacing: '12px' }}>
              {code || '???'}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.9rem', color: copied ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
              {copied ? '✅ Copied to clipboard!' : '👆 Tap to copy code'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '24px' }}>
            <Link href={`/showdown/${code}`} className="btn btn-primary">
              🏆 Open Showdown Screen
            </Link>
            <Link href="/" className="btn btn-secondary">
              🏠 Back Home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

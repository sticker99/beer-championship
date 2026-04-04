'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function BubbleBackground() {
  const [bubbles, setBubbles] = useState<Array<{ left: string; width: string; height: string; duration: string; delay: string }>>([]);

  useEffect(() => {
    setBubbles(Array.from({ length: 20 }).map(() => ({
      left: `${Math.random() * 100}%`,
      width: `${10 + Math.random() * 30}px`,
      height: `${10 + Math.random() * 30}px`,
      duration: `${4 + Math.random() * 8}s`,
      delay: `${Math.random() * 5}s`,
    })));
  }, []);

  return (
    <div className="bubbles-bg">
      {bubbles.map((b, i) => (
        <div
          key={i}
          className="bubble"
          style={{
            left: b.left,
            width: b.width,
            height: b.height,
            animationDuration: b.duration,
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <BubbleBackground />
      <main className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '40px 20px' }}>
        
        {/* Hero beer emojis */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', opacity: mounted ? 1 : 0, transition: 'opacity 0.5s' }}>
          <span className="beer-emoji" style={{ animationDelay: '0s' }}>🍺</span>
          <span className="beer-emoji" style={{ animationDelay: '0.3s' }}>🏆</span>
          <span className="beer-emoji" style={{ animationDelay: '0.6s' }}>🍻</span>
        </div>

        <div className="glass-panel animate-fade-in" style={{ textAlign: 'center', maxWidth: '650px', width: '100%' }}>
          <h1 className="title-display" style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', marginBottom: '8px', lineHeight: 1.1 }}>
            Beer Championship
          </h1>
          
          <p className="title-marker" style={{ fontSize: '1.3rem', marginBottom: '24px', color: 'var(--neon-pink)' }}>
            Who will be crowned the ultimate brew? 👑
          </p>
          
          <p style={{ fontSize: '1.1rem', marginBottom: '32px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Gather your crew, taste some amazing craft beers, rate them blind, and reveal the champion in an epic showdown! 
          </p>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/admin" className="btn btn-primary">
              🎉 Host a Tasting
            </Link>
            <Link href="/join" className="btn btn-secondary">
              🍺 Join Session
            </Link>
          </div>

          <div style={{ marginTop: '32px', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>📋</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Add Beers</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>⭐</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rate &amp; Score</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem' }}>🏆</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Crown the Champ</div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

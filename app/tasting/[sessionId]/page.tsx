'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';

interface Beer {
  name: string;
  brewery: string;
  type: string;
}

interface Session {
  id: string;
  name: string;
  beers: Beer[];
}

const RatingSlider = ({ label, emoji, field, value, onChange }: { label: string, emoji: string, field: string, value: number, onChange: (field: string, value: number) => void }) => {
  const getValueEmoji = (val: number) => {
    if (val <= 1.5) return '😬';
    if (val <= 2.5) return '😐';
    if (val <= 3.5) return '🙂';
    if (val <= 4.5) return '😍';
    return '🤩';
  };

  return (
    <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <label style={{ fontWeight: 700, fontSize: '1.05rem' }}>{emoji} {label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem' }}>{getValueEmoji(value)}</span>
          <span style={{ 
            color: 'var(--amber-light)', 
            fontFamily: 'var(--font-display)', 
            fontSize: '1.4rem',
            letterSpacing: '1px'
          }}>
            {value}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>/ 5</span>
        </div>
      </div>
      <input 
        type="range" 
        min="1" max="5" step="0.5" 
        value={value}
        onChange={(e) => onChange(field, parseFloat(e.target.value))}
      />
    </div>
  );
};

export default function TastingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParams = useParams();
  const userName = searchParams.get('name') || 'Anonymous Tester';
  const sessionId = nextParams.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [currentBeerIndex, setCurrentBeerIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<number, { aroma: number, appearance: number, taste: number, overall: number }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/session/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(true);
        else setSession(data);
      });
  }, [sessionId]);

  const handleRatingChange = (category: string, value: number) => {
    const defaults = { aroma: 3, appearance: 3, taste: 3, overall: 3 };
    setRatings(prev => ({
      ...prev,
      [currentBeerIndex]: {
        ...defaults,
        ...prev[currentBeerIndex],
        [category]: value
      }
    }));
  };

  const submitAllRatings = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/rating/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userName, ratings })
      });
      if (res.ok) setIsFinished(true);
      else alert("Failed to save ratings 😢");
    } catch {
      alert("Error submitting ratings 😢");
    }
    setIsSubmitting(false);
  };

  const nextBeer = () => {
    if (currentBeerIndex < (session?.beers.length || 0) - 1) {
      setCurrentBeerIndex(prev => prev + 1);
    } else {
      submitAllRatings();
    }
  };

  if (error) return (
    <main className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '450px' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>😵</div>
        <h2 className="title-marker" style={{ color: 'var(--danger)', marginBottom: '16px' }}>Session Not Found!</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Double-check the code and try again.</p>
      </div>
    </main>
  );

  if (!session) return (
    <main className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem' }} className="animate-float">🍺</div>
      <h2 className="title-marker" style={{ marginTop: '16px', color: 'var(--amber-light)' }}>Pouring your tasting...</h2>
    </main>
  );

  if (isFinished) return (
    <main className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-panel animate-bounce-in" style={{ textAlign: 'center', maxWidth: '600px' }}>
        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉🍻🎉</div>
        <h1 className="title-display" style={{ fontSize: '2.5rem', marginBottom: '12px' }}>Tasting Complete!</h1>
        <p className="title-marker" style={{ color: 'var(--neon-green)', marginBottom: '24px' }}>
          Nice work, {userName}! 🙌
        </p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Your ratings have been locked in. Sit tight for the showdown!
        </p>
        <button onClick={() => router.push(`/showdown/${sessionId}`)} className="btn btn-primary">
          🏆 Go to Showdown
        </button>
      </div>
    </main>
  );

  const currentBeer = session.beers[currentBeerIndex];
  const currentRating = ratings[currentBeerIndex] || { aroma: 3, appearance: 3, taste: 3, overall: 3 };
  const progressPercent = ((currentBeerIndex + 1) / session.beers.length) * 100;

  return (
    <main className="container" style={{ padding: '30px 20px', maxWidth: '600px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }} className="animate-fade-in">
        <p className="title-marker" style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>{session.name}</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
          Hey {userName}! 👋
        </p>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: '24px' }} className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <span>Beer {currentBeerIndex + 1} of {session.beers.length}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Beer Card */}
      <div className="glass-panel animate-fade-in" key={`beer-${currentBeerIndex}`}>
        <div style={{ 
          background: 'rgba(0,0,0,0.3)', 
          padding: '24px', 
          borderRadius: '16px', 
          marginBottom: '28px', 
          textAlign: 'center',
          border: '1px solid rgba(245, 158, 11, 0.15)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🍺</div>
          <h3 className="title-display" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{currentBeer.name}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
            {currentBeer.brewery} {currentBeer.type && `• ${currentBeer.type}`}
          </p>
        </div>

        <RatingSlider label="Aroma" emoji="👃" field="aroma" value={currentRating.aroma} onChange={handleRatingChange} />
        <RatingSlider label="Appearance" emoji="👀" field="appearance" value={currentRating.appearance} onChange={handleRatingChange} />
        <RatingSlider label="Taste" emoji="👅" field="taste" value={currentRating.taste} onChange={handleRatingChange} />
        <RatingSlider label="Overall Vibes" emoji="🤙" field="overall" value={currentRating.overall} onChange={handleRatingChange} />

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          {currentBeerIndex > 0 && (
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCurrentBeerIndex(p => p - 1)}>
              ← Back
            </button>
          )}
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={nextBeer} disabled={isSubmitting}>
            {currentBeerIndex === session.beers.length - 1 
              ? (isSubmitting ? '🔄 Submitting...' : '🏁 Finish Tasting!') 
              : 'Next Beer 🍺 →'}
          </button>
        </div>
      </div>
    </main>
  );
}

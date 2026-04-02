'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface BeerInput {
  name: string;
  brewery: string;
  type: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState('');
  const [beers, setBeers] = useState<BeerInput[]>([{ name: '', brewery: '', type: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addBeer = () => {
    setBeers([...beers, { name: '', brewery: '', type: '' }]);
  };

  const updateBeer = (index: number, field: keyof BeerInput, value: string) => {
    const newBeers = [...beers];
    newBeers[index][field] = value;
    setBeers(newBeers);
  };

  const removeBeer = (index: number) => {
    setBeers(beers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName || beers.some(b => !b.name)) return alert("Don't forget to name all your beers! 🍺");
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName, beers })
      });
      const data = await res.json();
      if (data.sessionId) {
        router.push(`/admin/success?code=${data.sessionId}`);
      }
    } catch {
      alert("Something went wrong! Try again. 😢");
    }
    setIsSubmitting(false);
  };

  const beerEmojis = ['🍺', '🍻', '🥂', '🍷', '🥃', '🍾', '🫗', '🍹'];

  return (
    <main className="container" style={{ padding: '40px 20px', maxWidth: '800px', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }} className="animate-fade-in">
        <span style={{ fontSize: '3rem' }}>🎯</span>
        <h1 className="title-display" style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', marginTop: '8px' }}>
          Set Up Your Tasting
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '1.1rem' }}>
          Add the beers and let the battle begin!
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px', animationDelay: '0.15s' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: 700, fontSize: '1.1rem' }}>
            🏷️ Event Name
          </label>
          <input 
            className="input-field" 
            placeholder="e.g. Friday Night IPA Throwdown" 
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            required
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 className="title-marker" style={{ fontSize: '1.5rem' }}>
              🍺 The Lineup
            </h2>
            <button type="button" onClick={addBeer} className="btn btn-secondary" style={{ padding: '10px 20px', fontSize: '0.95rem' }}>
              + Add Beer
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {beers.map((beer, index) => (
              <div 
                key={index} 
                className="animate-fade-in"
                style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  alignItems: 'center', 
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '20px', 
                  borderRadius: '16px',
                  border: '1px solid rgba(245, 158, 11, 0.1)',
                  animationDelay: `${index * 0.05}s`
                }}
              >
                <div style={{ fontSize: '2rem', flexShrink: 0 }}>
                  {beerEmojis[index % beerEmojis.length]}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input 
                    className="input-field" 
                    placeholder={`Beer #${index + 1} Name`} 
                    value={beer.name}
                    onChange={(e) => updateBeer(index, 'name', e.target.value)}
                    required
                    style={{ fontWeight: 700 }}
                  />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      className="input-field" 
                      placeholder="Brewery" 
                      value={beer.brewery}
                      onChange={(e) => updateBeer(index, 'brewery', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input 
                      className="input-field" 
                      placeholder="Style (e.g. IPA)" 
                      value={beer.type}
                      onChange={(e) => updateBeer(index, 'type', e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
                {beers.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeBeer(index)} 
                    className="btn" 
                    style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '1.2rem' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary animate-pulse" 
          style={{ width: '100%', marginTop: '8px', fontSize: '1.3rem', padding: '18px' }} 
          disabled={isSubmitting}
        >
          {isSubmitting ? '🔄 Creating...' : '🚀 Launch Tasting Session!'}
        </button>
      </form>
    </main>
  );
}

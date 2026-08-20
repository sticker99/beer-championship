'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { loadDraft, saveDraft, clearDraft } from '@/lib/useTastingDraft';

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

type Ratings = Record<number, { aroma: number; appearance: number; taste: number; overall: number }>;
type TastingView = 'rating' | 'confirmation';

const RatingSlider = ({
  label, emoji, field, value, onChange,
}: {
  label: string; emoji: string; field: string; value: number;
  onChange: (field: string, value: number) => void;
}) => {
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
          <span style={{ color: 'var(--amber-light)', fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '1px' }}>{value}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>/ 5</span>
        </div>
      </div>
      <input type="range" min="1" max="5" step="0.5" value={value} onChange={(e) => onChange(field, parseFloat(e.target.value))} />
    </div>
  );
};

function TastingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParams = useParams();
  const userName = searchParams.get('name') || 'Anonymous Taster';
  const sessionId = nextParams.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [currentBeerIndex, setCurrentBeerIndex] = useState(0);
  const [ratings, setRatings] = useState<Ratings>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [view, setView] = useState<TastingView>('rating');
  const [showDrawer, setShowDrawer] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    fetch(`/api/session/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(true);
        else setSession(data);
      });
  }, [sessionId]);

  // Restore any in-progress draft for this session+user, once, before autosave kicks in.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const draft = loadDraft(sessionId, userName);
    if (draft) {
      setRatings(draft.ratings);
      setCurrentBeerIndex(draft.currentBeerIndex);
      setView(draft.view);
    }
  }, [sessionId, userName]);

  // A restored beer index could be out of range if the beer list changed since the draft was saved.
  useEffect(() => {
    if (session && currentBeerIndex > session.beers.length - 1) {
      setCurrentBeerIndex(Math.max(0, session.beers.length - 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Autosave the draft (debounced) so a closed tab doesn't lose progress.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      saveDraft(sessionId, userName, { ratings, currentBeerIndex, view });
      setDraftSavedAt(Date.now());
    }, 250);
    return () => clearTimeout(t);
  }, [ratings, currentBeerIndex, view, sessionId, userName]);

  const handleRatingChange = (category: string, value: number) => {
    const defaults = { aroma: 3, appearance: 3, taste: 3, overall: 3 };
    setRatings(prev => ({
      ...prev,
      [currentBeerIndex]: { ...defaults, ...prev[currentBeerIndex], [category]: value },
    }));
  };

  const submitAllRatings = async () => {
    setIsSubmitting(true);
    setSubmitError(false);
    try {
      const res = await fetch('/api/rating/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userName, ratings }),
      });
      if (res.ok) {
        clearDraft(sessionId, userName);
        setIsFinished(true);
      } else {
        setSubmitError(true);
      }
    } catch {
      setSubmitError(true);
    }
    setIsSubmitting(false);
  };

  const goToReview = () => {
    setView('confirmation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBackToRating = (index?: number) => {
    setView('rating');
    if (index !== undefined) setCurrentBeerIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextBeer = () => {
    if (!session) return;
    if (currentBeerIndex < session.beers.length - 1) {
      setCurrentBeerIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      goToReview();
    }
  };

  const jumpToBeer = (index: number) => {
    setCurrentBeerIndex(index);
    setShowDrawer(false);
    setView('rating');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Loading / error / finished ──────────────────────────────────────────

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
        <p className="title-marker" style={{ color: 'var(--neon-green)', marginBottom: '24px' }}>Nice work, {userName}! 🙌</p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Your ratings have been locked in. Sit tight for the showdown!</p>
        <button onClick={() => router.push(`/showdown/${sessionId}`)} className="btn btn-primary">🏆 Go to Showdown</button>
      </div>
    </main>
  );

  const totalBeers = session.beers.length;
  const ratedCount = Object.keys(ratings).length;

  const ratingEmoji = (val: number) => {
    if (val <= 1.5) return '😬'; if (val <= 2.5) return '😐';
    if (val <= 3.5) return '🙂'; if (val <= 4.5) return '😍';
    return '🤩';
  };

  // ── Confirmation screen ─────────────────────────────────────────────────

  if (view === 'confirmation') {
    return (
      <main className="container animate-fade-in" style={{ padding: '30px 20px 48px', maxWidth: '600px', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📋</div>
          <h1 className="title-display" style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', marginBottom: '8px' }}>Review Your Scores</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Happy with everything? Tap any beer to edit, then lock them in.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
          {session.beers.map((beer, index) => {
            const r = ratings[index] || { aroma: 3, appearance: 3, taste: 3, overall: 3 };
            const total = r.aroma + r.appearance + r.taste + r.overall;
            const avgVal = total / 4;
            return (
              <div
                key={index}
                className="glass-panel taster-card"
                style={{ padding: '14px 18px', cursor: 'pointer' }}
                onClick={() => goBackToRating(index)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>{ratingEmoji(avgVal)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '1px', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {beer.name}
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {[
                        { label: '👃', val: r.aroma },
                        { label: '👀', val: r.appearance },
                        { label: '👅', val: r.taste },
                        { label: '🤙', val: r.overall },
                      ].map(({ label, val }) => (
                        <span key={label} style={{
                          fontSize: '0.75rem', padding: '2px 8px', borderRadius: '999px',
                          background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)',
                          fontFamily: 'var(--font-display)',
                        }}>
                          {label} {val}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--amber-light)' }}>{total}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>/20</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px' }}>tap to edit ✏️</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {submitError && (
          <div className="glass-panel animate-fade-in" style={{
            padding: '14px 18px', marginBottom: '16px', textAlign: 'center',
            border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)',
          }}>
            <p style={{ color: 'var(--danger, #ef4444)', fontSize: '0.95rem', marginBottom: '4px' }}>
              😢 Couldn&apos;t save your ratings — connection hiccup.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              No worries, your scores are safe on this device. Just try again.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: '1.2rem', padding: '18px' }}
            onClick={submitAllRatings}
            disabled={isSubmitting}
          >
            {isSubmitting ? '🔄 Submitting...' : submitError ? '🔄 Retry Lock It In!' : '🔒 Lock It In!'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '1rem', padding: '14px' }}
            onClick={() => goBackToRating()}
          >
            ← Back to Rating
          </button>
        </div>
      </main>
    );
  }

  // ── Main rating screen ──────────────────────────────────────────────────

  const currentBeer = session.beers[currentBeerIndex];
  const currentRating = ratings[currentBeerIndex] || { aroma: 3, appearance: 3, taste: 3, overall: 3 };
  const progressPercent = ((currentBeerIndex + 1) / totalBeers) * 100;

  return (
    <>
      {/* Drawer backdrop */}
      {showDrawer && (
        <div className="drawer-backdrop" onClick={() => setShowDrawer(false)} />
      )}

      {/* Beer navigation drawer */}
      {showDrawer && (
        <div className="drawer-sheet">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="title-marker" style={{ fontSize: '1.1rem' }}>🍺 All Beers</h3>
            <button
              onClick={() => setShowDrawer(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.4rem', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
            >✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {session.beers.map((beer, index) => {
              const isRated = ratings[index] !== undefined;
              const isCurrent = index === currentBeerIndex && view === 'rating';
              return (
                <button
                  key={index}
                  onClick={() => jumpToBeer(index)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    width: '100%', padding: '12px 14px', textAlign: 'left',
                    background: isCurrent ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0,0,0,0.2)',
                    border: isCurrent ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {/* Rated indicator */}
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', fontFamily: 'var(--font-display)',
                    background: isRated ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: isRated ? '1px solid rgba(74, 222, 128, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                    color: isRated ? 'var(--neon-green)' : 'var(--text-secondary)',
                  }}>
                    {isRated ? '✓' : index + 1}
                  </div>

                  {/* Beer info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: '0.95rem', letterSpacing: '1px',
                      color: isCurrent ? 'var(--amber-light)' : 'var(--foam)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {beer.name}
                    </div>
                    {beer.brewery && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{beer.brewery}</div>
                    )}
                  </div>

                  {/* Rating summary emoji */}
                  {isRated && ratings[index] && (
                    <div style={{ fontSize: '1.1rem', flexShrink: 0 }}>
                      {ratingEmoji((ratings[index].aroma + ratings[index].appearance + ratings[index].taste + ratings[index].overall) / 4)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Review button when all rated */}
          {ratedCount === totalBeers && (
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px', padding: '14px', fontSize: '1rem' }}
              onClick={() => { setShowDrawer(false); goToReview(); }}
            >
              📋 Review & Submit
            </button>
          )}
        </div>
      )}

      <main className="container" style={{ padding: '30px 20px 48px', maxWidth: '600px', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }} className="animate-fade-in">
          <div>
            <p className="title-marker" style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>{session.name}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Hey {userName}! 👋</p>
          </div>
          {/* Beer nav pill */}
          <button
            onClick={() => setShowDrawer(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', flexShrink: 0,
              background: ratedCount === totalBeers ? 'rgba(74, 222, 128, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              border: ratedCount === totalBeers ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '999px',
              color: ratedCount === totalBeers ? 'var(--neon-green)' : 'var(--amber-light)',
              fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'var(--font-marker)',
              transition: 'all 0.2s',
            }}
          >
            <span>📋</span>
            <span>{ratedCount}/{totalBeers}</span>
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: '24px' }} className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <span>Beer {currentBeerIndex + 1} of {totalBeers}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          {draftSavedAt !== null && (
            <div
              key={draftSavedAt}
              className="animate-fade-in"
              style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right' }}
            >
              💾 saved on this device
            </div>
          )}
        </div>

        {/* Beer card */}
        <div className="glass-panel animate-fade-in" key={`beer-${currentBeerIndex}`}>
          <div style={{
            background: 'rgba(0,0,0,0.3)', padding: '24px', borderRadius: '16px',
            marginBottom: '28px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.15)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🍺</div>
            <h3 className="title-display" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{currentBeer.name}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
              {currentBeer.brewery}{currentBeer.type ? ` • ${currentBeer.type}` : ''}
            </p>
          </div>

          <RatingSlider label="Aroma" emoji="👃" field="aroma" value={currentRating.aroma} onChange={handleRatingChange} />
          <RatingSlider label="Appearance" emoji="👀" field="appearance" value={currentRating.appearance} onChange={handleRatingChange} />
          <RatingSlider label="Taste" emoji="👅" field="taste" value={currentRating.taste} onChange={handleRatingChange} />
          <RatingSlider label="Overall Vibes" emoji="🤙" field="overall" value={currentRating.overall} onChange={handleRatingChange} />

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            {currentBeerIndex > 0 && (
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setCurrentBeerIndex(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                ← Back
              </button>
            )}
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={nextBeer}>
              {currentBeerIndex === totalBeers - 1 ? '📋 Review Scores' : 'Next Beer 🍺 →'}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

export default function TastingPage() {
  return (
    <Suspense fallback={
      <main className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem' }} className="animate-float">🍺</div>
        <h2 className="title-marker" style={{ marginTop: '16px', color: 'var(--amber-light)' }}>Pouring your tasting...</h2>
      </main>
    }>
      <TastingPageInner />
    </Suspense>
  );
}

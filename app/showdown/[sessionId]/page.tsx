'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';

interface IndividualScore {
  userName: string;
  ratings: { aroma: number; appearance: number; taste: number; overall: number };
  total: number;
}

interface BeerResult {
  name: string;
  brewery: string;
  type: string;
  index: number;
  ratingCount: number;
  averageScore: number;
  scorePercentage: number;
  averageCategories: {
    aroma: number;
    appearance: number;
    taste: number;
    overall: number;
  } | null;
  individualScores: IndividualScore[];
}

interface TasterInsight {
  userName: string;
  averageGiven: number;
  stdDeviation: number;
  favouriteBeer: { name: string; score: number } | null;
  leastFavouriteBeer: { name: string; score: number } | null;
  agreedWithWinner: boolean;
  archetype: string;
  avgCategories: { aroma: number; appearance: number; taste: number; overall: number };
  beersRated: number;
}

interface Superlatives {
  mostConsistent: { userName: string; value: number };
  wildcard: { userName: string; value: number };
  generous: { userName: string; value: number };
  harsh: { userName: string; value: number };
  agreedWithWinnerCount: number;
  totalTasters: number;
}

interface ShowdownData {
  session: { name: string };
  participantsCount: number;
  participants: string[];
  results: BeerResult[];
  tasterInsights: TasterInsight[];
  superlatives: Superlatives | null;
}

// Reveal phases
type RevealPhase = 'waiting' | 'the-pack' | 'bronze-intro' | 'bronze' | 'silver-intro' | 'silver' | 'gold-intro' | 'drumroll' | 'champion' | 'done';

// Seeded shuffle for consistent mystery card order
function shuffleWithSeed(arr: BeerResult[], seed: number): BeerResult[] {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Archetype emoji mapping
function getArchetypeEmoji(archetype: string): string {
  const map: Record<string, string> = {
    'The Diplomat': '🤝',
    'The Perfectionist': '🎯',
    'The Contrarian': '🤪',
    'The Cheerleader': '📣',
    'The Critic': '🧐',
    'The Nose': '👃',
    'The Aesthete': '🎨',
    'The Sommelier': '🍷',
    'The Vibes Guru': '✨',
    'The Taster': '🍺',
  };
  return map[archetype] || '🍺';
}

export default function ShowdownPage() {
  const params = useParams();
  const sessionId = String(params.sessionId).toUpperCase();
  const [data, setData] = useState<ShowdownData | null>(null);
  const [phase, setPhase] = useState<RevealPhase>('waiting');
  const [refreshing, setRefreshing] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<Array<{ left: number; color: string; delay: number; duration: number; size: number; shape: string }>>([]);
  const [expandedBeer, setExpandedBeer] = useState<number | null>(null);
  const [expandedTaster, setExpandedTaster] = useState<string | null>(null);
  const [showInsightsToast, setShowInsightsToast] = useState(false);

  const podiumRef = useRef<HTMLDivElement>(null);
  const insightsRef = useRef<HTMLDivElement>(null);

  const fetchResults = useCallback(async () => {
    setRefreshing(true);
    const res = await fetch(`/api/session/${sessionId}/results`);
    const json = await res.json();
    if (!json.error) setData(json);
    setRefreshing(false);
  }, [sessionId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const shuffledResults = useMemo(() => {
    if (!data) return [];
    return shuffleWithSeed(data.results, sessionId.charCodeAt(0) * 1000 + data.results.length);
  }, [data, sessionId]);

  // Show insights toast when phase becomes 'done'
  useEffect(() => {
    if (phase === 'done' && data?.tasterInsights && data.tasterInsights.length > 0) {
      // Small delay so the main content transition settles first
      const t = setTimeout(() => {
        setShowInsightsToast(true);
        // Auto-scroll to insights section
        setTimeout(() => {
          insightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 400);
        // Hide toast after 5s
        setTimeout(() => setShowInsightsToast(false), 5000);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [phase, data?.tasterInsights]);

  const triggerConfetti = (count = 100) => {
    const pieces = Array.from({ length: count }).map(() => ({
      left: Math.random() * 100,
      color: ['#fbbf24', '#f472b6', '#38bdf8', '#4ade80', '#f59e0b', '#a78bfa', '#fb923c', '#f87171'][Math.floor(Math.random() * 8)],
      delay: Math.random() * 3,
      duration: 2.5 + Math.random() * 4,
      size: 6 + Math.random() * 10,
      shape: Math.random() > 0.5 ? '50%' : '2px',
    }));
    setConfettiPieces(pieces);
  };

  if (!data) return (
    <main className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem' }} className="animate-float">🏆</div>
      <h2 className="title-marker" style={{ marginTop: '16px', color: 'var(--amber-light)' }}>Preparing the Showdown...</h2>
    </main>
  );

  const results = data.results;
  const podiumCount = Math.min(results.length, 3);
  const packBeers = results.slice(podiumCount);
  const podiumBeers = results.slice(0, podiumCount);

  const isRevealed = (rankIndex: number) => {
    if (rankIndex >= 3) return phase !== 'waiting'; // pack beers
    if (rankIndex === 2) return ['bronze', 'silver-intro', 'silver', 'gold-intro', 'drumroll', 'champion', 'done'].includes(phase);
    if (rankIndex === 1) return ['silver', 'gold-intro', 'drumroll', 'champion', 'done'].includes(phase);
    if (rankIndex === 0) return ['champion', 'done'].includes(phase);
    return false;
  };

  // Auto-scroll when podium sequence starts
  const startPodiumSequence = (startWith: 'bronze' | 'silver' | 'drumroll') => {
    // Scroll to top so users see the podium cards appearing
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const steps: Array<{ phase: RevealPhase; delay: number; confetti?: number }> = [];

    if (startWith === 'bronze') {
      steps.push({ phase: 'bronze-intro', delay: 0 });
      steps.push({ phase: 'bronze', delay: 2500, confetti: 30 });
      steps.push({ phase: 'silver-intro', delay: 4500 });
      steps.push({ phase: 'silver', delay: 7000, confetti: 50 });
      steps.push({ phase: 'drumroll', delay: 9000 });
      steps.push({ phase: 'champion', delay: 12500, confetti: 120 });
    } else if (startWith === 'silver') {
      steps.push({ phase: 'silver-intro', delay: 0 });
      steps.push({ phase: 'silver', delay: 2500, confetti: 50 });
      steps.push({ phase: 'drumroll', delay: 4500 });
      steps.push({ phase: 'champion', delay: 8000, confetti: 120 });
    } else {
      steps.push({ phase: 'drumroll', delay: 0 });
      steps.push({ phase: 'champion', delay: 3500, confetti: 120 });
    }

    steps.forEach(({ phase: p, delay, confetti }) => {
      setTimeout(() => {
        setPhase(p);
        if (confetti) triggerConfetti(confetti);
      }, delay);
    });
  };

  const handleNextPhase = () => {
    const total = results.length;
    switch (phase) {
      case 'waiting':
        if (total === 1) {
          startPodiumSequence('drumroll');
        } else if (packBeers.length > 0) {
          setPhase('the-pack');
        } else {
          startPodiumSequence(total >= 3 ? 'bronze' : 'silver');
        }
        break;
      case 'the-pack':
        startPodiumSequence(total >= 3 ? 'bronze' : 'silver');
        break;
      case 'champion':
        setPhase('done');
        break;
      case 'done':
        setPhase('champion');
        triggerConfetti(100);
        break;
    }
  };

  const getButtonLabel = () => {
    switch (phase) {
      case 'waiting':
        if (results.length === 1) return '👑 Reveal the Champion!';
        if (packBeers.length > 0) return '🥁 Reveal the Also-Rans!';
        return '🏆 Reveal the Podium!';
      case 'the-pack': return '🏆 Reveal the Podium!';
      case 'done': return '👑 Show Champion Again';
      default: return '';
    }
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankClass = (rank: number) => {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return 'rank-other';
  };

  const mysteryEmojis = ['🍺', '🍻', '🥂', '🥃', '🍷', '🍾', '🫗', '🍹'];

  const getCategoryBar = (value: number, color: string) => (
    <div className="score-bar-track" style={{ flex: 1 }}>
      <div className="score-bar-fill" style={{ width: `${(value / 5) * 100}%`, background: color }} />
    </div>
  );

  const renderBeerCard = (beer: BeerResult, rank: number, revealed: boolean, isTopCard: boolean) => {
    const isWinner = rank === 1 && revealed;
    const isExpanded = expandedBeer === beer.index;

    return (
      <div 
        key={beer.index} 
        className={`glass-panel ${revealed ? 'animate-fade-in' : ''}`}
        style={{ 
          position: 'relative',
          overflow: 'hidden',
          border: isWinner 
            ? '2px solid var(--amber)' 
            : rank === 2 && revealed 
              ? '2px solid rgba(192, 192, 192, 0.4)' 
              : rank === 3 && revealed 
                ? '2px solid rgba(217, 119, 6, 0.4)' 
                : revealed ? undefined : '2px solid rgba(255, 255, 255, 0.05)',
          boxShadow: isWinner ? '0 0 40px rgba(251, 191, 36, 0.3)' : undefined,
          transition: 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
          padding: isTopCard ? '24px' : '16px',
          background: revealed ? undefined : 'rgba(20, 10, 0, 0.7)',
          cursor: revealed && beer.individualScores.length > 0 ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (revealed && beer.individualScores.length > 0) {
            setExpandedBeer(isExpanded ? null : beer.index);
          }
        }}
      >
        {/* Winner badge */}
        {isWinner && (
          <div style={{ 
            position: 'absolute', top: '10px', right: '10px', 
            background: 'linear-gradient(135deg, var(--amber), var(--copper))',
            color: 'var(--dark-brown)', padding: '4px 14px', borderRadius: '999px',
            fontFamily: 'var(--font-display)', fontSize: '0.85rem', letterSpacing: '2px',
          }}>
            👑 CHAMPION
          </div>
        )}
        
        {revealed ? (
          <>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div className={`rank-badge ${getRankClass(rank)}`}>{getRankEmoji(rank)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ 
                  fontSize: isTopCard ? '1.5rem' : '1.2rem', 
                  fontFamily: 'var(--font-display)', letterSpacing: '1px', marginBottom: '2px'
                }}>
                  {beer.name}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {beer.brewery} {beer.type && `• ${beer.type}`}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ 
                  fontSize: isTopCard ? '2rem' : '1.6rem', fontFamily: 'var(--font-display)',
                  color: 'var(--amber-light)', textShadow: '0 0 15px rgba(251, 191, 36, 0.3)', letterSpacing: '1px'
                }}>
                  {beer.averageScore}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--neon-green)' }}>{beer.scorePercentage}%</div>
              </div>
            </div>

            {/* Category breakdown */}
            {beer.averageCategories && isTopCard && (
              <div style={{ 
                marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px'
              }}>
                {[
                  { label: '👃 Aroma', val: beer.averageCategories.aroma, color: 'var(--amber)' },
                  { label: '👀 Look', val: beer.averageCategories.appearance, color: 'var(--neon-blue)' },
                  { label: '👅 Taste', val: beer.averageCategories.taste, color: 'var(--neon-pink)' },
                  { label: '🤙 Vibes', val: beer.averageCategories.overall, color: 'var(--neon-green)' },
                ].map(cat => (
                  <div key={cat.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{cat.label}</div>
                    {getCategoryBar(cat.val, cat.color)}
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '4px' }}>{cat.val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Individual scores (expandable) */}
            {revealed && beer.individualScores.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ 
                  fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center',
                  padding: '6px', cursor: 'pointer',
                }}>
                  {isExpanded ? '▲ Hide individual scores' : `▼ Show ${beer.individualScores.length} individual score${beer.individualScores.length > 1 ? 's' : ''}`}
                </div>
                {isExpanded && (
                  <div style={{ 
                    marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px',
                    animation: 'fadeInUp 0.3s ease',
                  }}>
                    {[...beer.individualScores]
                      .sort((a, b) => b.total - a.total || a.userName.localeCompare(b.userName))
                      .map((score, i) => (
                      <div key={i} style={{ 
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                        background: 'rgba(0,0,0,0.25)', borderRadius: '10px', fontSize: '0.85rem',
                      }}>
                        <span style={{ flex: 1, fontWeight: 600, color: 'var(--foam)' }}>
                          {score.userName}
                        </span>
                        <span style={{ color: 'rgba(254,243,199,0.4)', fontSize: '0.75rem' }}>
                          👃{score.ratings.aroma}
                        </span>
                        <span style={{ color: 'rgba(254,243,199,0.4)', fontSize: '0.75rem' }}>
                          👀{score.ratings.appearance}
                        </span>
                        <span style={{ color: 'rgba(254,243,199,0.4)', fontSize: '0.75rem' }}>
                          👅{score.ratings.taste}
                        </span>
                        <span style={{ color: 'rgba(254,243,199,0.4)', fontSize: '0.75rem' }}>
                          🤙{score.ratings.overall}
                        </span>
                        <span style={{ 
                          fontFamily: 'var(--font-display)', color: 'var(--amber-light)', 
                          fontSize: '1rem', minWidth: '30px', textAlign: 'right',
                        }}>
                          {score.total}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Mystery card */
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div style={{ 
              width: '56px', height: '56px', borderRadius: '50%', 
              background: 'rgba(245, 158, 11, 0.1)', border: '2px dashed rgba(245, 158, 11, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0,
            }}>
              {mysteryEmojis[beer.index % mysteryEmojis.length]}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', letterSpacing: '1px', color: 'rgba(254, 243, 199, 0.15)' }}>
                Mystery Beer
              </h3>
              <p style={{ color: 'rgba(254, 243, 199, 0.08)', fontSize: '0.9rem' }}>??? • ???</p>
            </div>
            <div style={{ fontSize: '1.8rem', color: 'rgba(254, 243, 199, 0.08)' }}>?</div>
          </div>
        )}
      </div>
    );
  };

  // ===== TASTER INSIGHTS SECTION =====
  const renderTasterInsights = () => {
    if (!data.tasterInsights || data.tasterInsights.length === 0 || phase !== 'done') return null;

    const { superlatives, tasterInsights } = data;

    return (
      <div ref={insightsRef} className="animate-fade-in" style={{ marginTop: '48px', scrollMarginTop: '24px' }}>
        <h2 className="title-display" style={{ 
          textAlign: 'center', fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', marginBottom: '8px' 
        }}>
          Taster Insights
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '1rem' }}>
          How did everyone do? 🧐
        </p>

        {/* ===== SUPERLATIVES ===== */}
        {superlatives && (
          <div className="insights-superlatives">
            <div className="superlative-card" style={{ '--accent': 'var(--neon-green)' } as React.CSSProperties}>
              <div className="superlative-emoji">🎯</div>
              <div className="superlative-title">Most Consistent</div>
              <div className="superlative-name">{superlatives.mostConsistent.userName}</div>
              <div className="superlative-detail">σ = {superlatives.mostConsistent.value}</div>
            </div>
            <div className="superlative-card" style={{ '--accent': 'var(--neon-pink)' } as React.CSSProperties}>
              <div className="superlative-emoji">🎲</div>
              <div className="superlative-title">Wildcard</div>
              <div className="superlative-name">{superlatives.wildcard.userName}</div>
              <div className="superlative-detail">σ = {superlatives.wildcard.value}</div>
            </div>
            <div className="superlative-card" style={{ '--accent': 'var(--amber-light)' } as React.CSSProperties}>
              <div className="superlative-emoji">📣</div>
              <div className="superlative-title">Most Generous</div>
              <div className="superlative-name">{superlatives.generous.userName}</div>
              <div className="superlative-detail">avg {superlatives.generous.value}/20</div>
            </div>
            <div className="superlative-card" style={{ '--accent': 'var(--neon-blue)' } as React.CSSProperties}>
              <div className="superlative-emoji">🧐</div>
              <div className="superlative-title">Harshest Critic</div>
              <div className="superlative-name">{superlatives.harsh.userName}</div>
              <div className="superlative-detail">avg {superlatives.harsh.value}/20</div>
            </div>
          </div>
        )}

        {/* Winner agreement stat */}
        {superlatives && (
          <div style={{
            textAlign: 'center', margin: '20px 0 28px', padding: '12px 20px',
            background: 'rgba(74, 222, 128, 0.08)', borderRadius: '16px',
            border: '1px solid rgba(74, 222, 128, 0.15)',
          }}>
            <span style={{ color: 'var(--neon-green)', fontFamily: 'var(--font-marker)', fontSize: '1.1rem' }}>
              {superlatives.agreedWithWinnerCount}/{superlatives.totalTasters} tasters agreed on the champion! 
              {superlatives.agreedWithWinnerCount === superlatives.totalTasters ? ' 🤯 Unanimous!' : 
               superlatives.agreedWithWinnerCount === 0 ? ' 😱 Nobody saw it coming!' : ' 🍻'}
            </span>
          </div>
        )}

        {/* ===== PER-TASTER CARDS ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {tasterInsights.map((taster) => {
            const isExpanded = expandedTaster === taster.userName;
            return (
              <div
                key={taster.userName}
                className="glass-panel taster-card"
                onClick={() => setExpandedTaster(isExpanded ? null : taster.userName)}
                style={{ cursor: 'pointer', padding: '18px 22px' }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div className="taster-archetype-badge">
                    <span style={{ fontSize: '1.5rem' }}>{getArchetypeEmoji(taster.archetype)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', letterSpacing: '1px' }}>
                        {taster.userName}
                      </h3>
                      <span style={{ 
                        fontSize: '0.8rem', color: 'var(--neon-pink)', fontFamily: 'var(--font-marker)',
                        opacity: 0.8,
                      }}>
                        {taster.archetype}
                      </span>
                    </div>
                    <div style={{ 
                      display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', 
                      marginTop: '4px', flexWrap: 'wrap',
                    }}>
                      <span>avg {taster.averageGiven}/20</span>
                      <span>σ {taster.stdDeviation}</span>
                      {taster.agreedWithWinner ? (
                        <span style={{ color: 'var(--neon-green)' }}>✓ Agreed with winner</span>
                      ) : (
                        <span style={{ color: 'rgba(254,243,199,0.3)' }}>✗ Picked different</span>
                      )}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '0.8rem', color: 'var(--text-secondary)', flexShrink: 0,
                  }}>
                    {isExpanded ? '▲' : '▼'}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ marginTop: '16px', animation: 'fadeInUp 0.3s ease' }}>
                    {/* Favourite & Least Favourite */}
                    <div style={{ 
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px',
                    }}>
                      {taster.favouriteBeer && (
                        <div style={{ 
                          padding: '12px', background: 'rgba(74, 222, 128, 0.08)', 
                          borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.15)',
                        }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--neon-green)', marginBottom: '4px', fontFamily: 'var(--font-marker)' }}>
                            ❤️ Favourite
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{taster.favouriteBeer.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--amber-light)', fontFamily: 'var(--font-display)' }}>
                            {taster.favouriteBeer.score}/20
                          </div>
                        </div>
                      )}
                      {taster.leastFavouriteBeer && (
                        <div style={{ 
                          padding: '12px', background: 'rgba(239, 68, 68, 0.06)', 
                          borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.12)',
                        }}>
                          <div style={{ fontSize: '0.7rem', color: '#fca5a5', marginBottom: '4px', fontFamily: 'var(--font-marker)' }}>
                            😬 Least Fav
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{taster.leastFavouriteBeer.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--amber-light)', fontFamily: 'var(--font-display)' }}>
                            {taster.leastFavouriteBeer.score}/20
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Category breakdown */}
                    <div style={{ 
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
                      padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px',
                    }}>
                      {[
                        { label: '👃', cat: 'Aroma', val: taster.avgCategories.aroma, color: 'var(--amber)' },
                        { label: '👀', cat: 'Look', val: taster.avgCategories.appearance, color: 'var(--neon-blue)' },
                        { label: '👅', cat: 'Taste', val: taster.avgCategories.taste, color: 'var(--neon-pink)' },
                        { label: '🤙', cat: 'Vibes', val: taster.avgCategories.overall, color: 'var(--neon-green)' },
                      ].map(c => (
                        <div key={c.cat} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                            {c.label} {c.cat}
                          </div>
                          {getCategoryBar(c.val, c.color)}
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: '3px' }}>{c.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Confetti */}
      {confettiPieces.map((piece, i) => (
        <div key={i} className="confetti-piece" style={{
          left: `${piece.left}%`, backgroundColor: piece.color, animationDelay: `${piece.delay}s`,
          animationDuration: `${piece.duration}s`, borderRadius: piece.shape,
          width: `${piece.size}px`, height: `${piece.size}px`,
        }} />
      ))}

      {/* ===== PHASE OVERLAYS ===== */}

      {/* Bronze intro */}
      {phase === 'bronze-intro' && (
        <div className="phase-overlay">
          <div style={{ fontSize: '5rem', marginBottom: '16px' }}>🥉</div>
          <h1 className="title-display" style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}>3rd Place Goes To...</h1>
        </div>
      )}

      {/* Silver intro */}
      {phase === 'silver-intro' && (
        <div className="phase-overlay">
          <div style={{ fontSize: '5rem', marginBottom: '16px' }}>🥈</div>
          <h1 className="title-display" style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}>Runner-Up Is...</h1>
        </div>
      )}



      {/* Drumroll */}
      {phase === 'drumroll' && (
        <div className="phase-overlay">
          <div style={{ fontSize: '6rem', marginBottom: '24px' }} className="animate-pulse">🥁</div>
          <h1 className="title-display" style={{ fontSize: 'clamp(2rem, 8vw, 4rem)' }}>
            And the champion is...
          </h1>
          <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
            {['⏳', '⏳', '⏳'].map((dot, i) => (
              <span key={i} style={{ fontSize: '2.5rem', animation: `float 0.5s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }}>{dot}</span>
            ))}
          </div>
        </div>
      )}

      {/* Champion celebration */}
      {phase === 'champion' && podiumBeers.length > 0 && (
        <div 
          className="champion-overlay"
          onClick={handleNextPhase}
        >
          <div className="animate-bounce-in" style={{ textAlign: 'center', maxWidth: '600px' }}>
            <div style={{ fontSize: '5rem', marginBottom: '12px' }}>👑</div>
            <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-marker)' }}>
              The undisputed champion is...
            </div>
            <h1 className="title-display neon-text" style={{ fontSize: 'clamp(2.5rem, 10vw, 5rem)', marginBottom: '12px', lineHeight: 1.1 }}>
              {podiumBeers[0].name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', marginBottom: '8px' }}>
              {podiumBeers[0].brewery} {podiumBeers[0].type && `• ${podiumBeers[0].type}`}
            </p>
            <div style={{ 
              marginTop: '20px', padding: '14px 28px', 
              background: 'linear-gradient(135deg, var(--amber), var(--copper))',
              borderRadius: '16px', display: 'inline-block'
            }}>
              <span style={{ fontSize: '2.2rem', fontFamily: 'var(--font-display)', color: 'var(--dark-brown)', letterSpacing: '2px' }}>
                {podiumBeers[0].averageScore} / 20
              </span>
            </div>
            <div style={{ marginTop: '12px', color: 'var(--neon-green)', fontFamily: 'var(--font-marker)', fontSize: '1.2rem' }}>
              {podiumBeers[0].scorePercentage}% approval rating! 🎉
            </div>
            {/* Individual champion voters */}
            {podiumBeers[0].individualScores.length > 0 && (
              <div style={{ marginTop: '20px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {[...podiumBeers[0].individualScores].sort((a,b) => b.total - a.total || a.userName.localeCompare(b.userName)).map((s, i) => (
                  <div key={i} style={{ 
                    padding: '6px 14px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '999px',
                    fontSize: '0.85rem', border: '1px solid rgba(245, 158, 11, 0.2)',
                  }}>
                    {s.userName}: <span style={{ fontFamily: 'var(--font-display)', color: 'var(--amber-light)' }}>{s.total}</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ marginTop: '28px', color: 'rgba(254, 243, 199, 0.3)', fontSize: '0.85rem' }}>
              Tap anywhere to see all results
            </p>
          </div>
        </div>
      )}

      {/* ===== MAIN PAGE ===== */}
      <main className="container" style={{ padding: '40px 20px', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }} className="animate-fade-in">
          <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🏆</div>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {data.session.name} • {data.participantsCount} {data.participantsCount === 1 ? 'Taster' : 'Tasters'}
          </h2>
          <h1 className="title-display" style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)' }}>The Showdown</h1>
          <button onClick={fetchResults} className="btn btn-secondary" style={{ marginTop: '14px', padding: '8px 18px', fontSize: '0.9rem' }} disabled={refreshing}>
            {refreshing ? '🔄...' : '🔄 Refresh Votes'}
          </button>
        </div>

        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          {/* ===== TOP 3 PODIUM SECTION ===== */}
          {phase !== 'waiting' && (
            <div ref={podiumRef} style={{ marginBottom: '32px', scrollMarginTop: '24px' }}>
              <h2 className="title-marker" style={{ textAlign: 'center', color: 'var(--amber-light)', fontSize: '1.4rem', marginBottom: '20px' }}>
                🏆 The Podium
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {podiumBeers.map((beer, i) => {
                  const rank = i + 1;
                  return renderBeerCard(beer, rank, isRevealed(i), true);
                })}
              </div>
            </div>
          )}

          {/* ===== THE PACK (non-top-3) ===== */}
          {results.length > 3 && (
            <div>
              <h2 className="title-marker" style={{ 
                textAlign: 'center', color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '16px',
                opacity: phase === 'waiting' ? 0.3 : 1, transition: 'opacity 0.5s',
              }}>
                {phase === 'waiting' ? '🍺 All Beers' : '🍺 The Pack'}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {phase === 'waiting' ? (
                  // Before any reveal, show all shuffled mystery cards
                  shuffledResults.map((beer) => (
                    renderBeerCard(beer, -1, false, false)
                  ))
                ) : (
                  // After pack reveal, show sorted from #4 onward
                  packBeers.map((beer, i) => {
                    const rank = i + 4;
                    return renderBeerCard(beer, rank, true, false);
                  })
                )}
              </div>
            </div>
          )}

          {/* ===== MYSTERY CARDS (when only top 3, waiting phase) ===== */}
          {results.length <= 3 && phase === 'waiting' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {shuffledResults.map((beer) => renderBeerCard(beer, -1, false, false))}
            </div>
          )}

          {/* ===== TASTER INSIGHTS ===== */}
          {renderTasterInsights()}
        </div>

        {/* ===== STICKY REVEAL BUTTON ===== */}
        {(phase === 'waiting' || phase === 'the-pack' || phase === 'done') && (
          <div className="sticky-reveal-bar animate-fade-in">
            <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              {phase === 'done' && data.tasterInsights?.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '12px 20px', fontSize: '0.95rem', flexShrink: 0 }}
                  onClick={() => insightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  🧐 See Insights
                </button>
              )}
              <button
                className="btn btn-primary animate-pulse"
                style={{ fontSize: '1.1rem', padding: '14px 32px' }}
                onClick={handleNextPhase}
              >
                {getButtonLabel()}
              </button>
            </div>
            {phase === 'waiting' && (
              <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
                {results.length} beers • {data.participantsCount} tasters • Let the showdown begin!
              </p>
            )}
          </div>
        )}
      </main>

      {/* ===== INSIGHTS TOAST ===== */}
      {showInsightsToast && (
        <div
          className="insights-toast animate-fade-in"
          onClick={() => {
            setShowInsightsToast(false);
            insightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>🧐</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Taster Insights unlocked!</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '2px' }}>Tap to jump to individual breakdowns ↓</div>
          </div>
          <span style={{ fontSize: '1.1rem', opacity: 0.5 }}>✕</span>
        </div>
      )}
    </>
  );
}

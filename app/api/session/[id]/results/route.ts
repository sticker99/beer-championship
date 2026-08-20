import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface BeerInput {
  name: string;
  brewery: string;
  type: string;
}

interface Rating {
  aroma: number;
  appearance: number;
  taste: number;
  overall: number;
}

interface UserRatingData {
  userName: string;
  ratings: Record<number, Rating>;
  submittedAt: number;
}

interface SessionData {
  id: string;
  name: string;
  beers: BeerInput[];
  createdAt: number;
  status: string;
}

// Safely extract rating fields, defaulting missing values to 3 (the slider default)
function safeRating(rating: Record<string, unknown>): Rating {
  return {
    aroma: typeof rating.aroma === 'number' ? rating.aroma : 3,
    appearance: typeof rating.appearance === 'number' ? rating.appearance : 3,
    taste: typeof rating.taste === 'number' ? rating.taste : 3,
    overall: typeof rating.overall === 'number' ? rating.overall : 3,
  };
}

// Cheap deterministic string hash, used to break exact-tie archetype scores
// without silently favouring whichever archetype was declared first in the
// scoring object (which is what Array.sort's stability would otherwise do).
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

// How much score a taster is allowed to sacrifice, relative to their true
// best-fit archetype, in order to avoid duplicating an archetype someone
// else in the session already has. Keeps reassignment honest — never force
// someone into a wildly bad-fit archetype just for variety's sake.
const DISHONESTY_MAX = 3.0;
// Score gap below which two archetypes are considered a genuine tie for a
// taster — genuine ties are allowed to duplicate rather than being split up.
const TIE_EPS = 0.05;

// Session-level archetype assignment. Takes every taster's full archetype
// score vector and assigns one archetype each, preferring to spread distinct
// archetypes across the group (most-decisive tasters get first pick of the
// pool) while never forcing a bad-fit archetype just to avoid a duplicate,
// and always allowing genuine ties/near-ties to duplicate honestly.
function assignArchetypes(
  tasters: { userName: string; scores: Record<string, number> }[]
): Record<string, string> {
  const withMeta = tasters.map(t => {
    const sorted = Object.entries(t.scores).sort((a, b) =>
      b[1] !== a[1] ? b[1] - a[1] : hashStr(t.userName + a[0]) - hashStr(t.userName + b[0])
    );
    const margin = sorted.length > 1 ? sorted[0][1] - sorted[1][1] : Infinity;
    return { userName: t.userName, sorted, margin, topScore: sorted[0][1] };
  });

  // Most-decisive (least-ambiguous) tasters get first pick of the pool.
  withMeta.sort((a, b) => b.margin - a.margin);

  const taken = new Set<string>();
  const result: Record<string, string> = {};

  for (const t of withMeta) {
    const topTiedCount = t.sorted.filter(([, v]) => t.topScore - v <= TIE_EPS).length;

    let chosen: string | null = null;
    if (topTiedCount === 1) {
      for (const [name, score] of t.sorted) {
        if (!taken.has(name)) {
          if (t.topScore - score <= DISHONESTY_MAX) chosen = name;
          break; // first untaken option found; either take it or give up and fall back below
        }
      }
    }
    if (!chosen) chosen = t.sorted[0][0]; // honest duplicate: genuine tie, exhausted pool, or too dishonest a fit
    taken.add(chosen);
    result[t.userName] = chosen;
  }

  return result;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const sessionId = resolvedParams.id.toUpperCase();
    
    // 1. Get Session Details
    const sessionData = await db.get(`session:${sessionId}`) as SessionData | null;
    if (!sessionData) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    
    // 2. Get Participants
    const participants = await db.smembers(`session:${sessionId}:participants`) as string[];
    
    // 3. Get all ratings
    const allRatings = await Promise.all(
      participants.map(p => db.get(`session:${sessionId}:ratings:${p}`))
    ) as (UserRatingData | null)[];

    // 4. Aggregate per-beer
    const beers = sessionData.beers;
    const aggregated = beers.map((beer: BeerInput, index: number) => {
      let totalScore = 0;
      let count = 0;
      const categories = { aroma: 0, appearance: 0, taste: 0, overall: 0 };
      
      // Collect individual scores
      const individualScores: Array<{ userName: string; ratings: Rating; total: number }> = [];
      
      allRatings.forEach((userRatingData) => {
        if (!userRatingData || !userRatingData.ratings) return;
        const rawRating = userRatingData.ratings[index];
        if (rawRating) {
          const rating = safeRating(rawRating as unknown as Record<string, unknown>);
          const userTotal = rating.aroma + rating.appearance + rating.taste + rating.overall;
          totalScore += userTotal;
          categories.aroma += rating.aroma;
          categories.appearance += rating.appearance;
          categories.taste += rating.taste;
          categories.overall += rating.overall;
          count++;
          
          individualScores.push({
            userName: userRatingData.userName,
            ratings: rating,
            total: userTotal,
          });
        }
      });
      
      const maxPossiblePerPerson = 20; // 5 * 4

      // How much did tasters disagree on this beer? Same stdDev calculation
      // used for per-taster consistency, applied across tasters for one beer.
      const avgTotal = count > 0 ? totalScore / count : 0;
      const scoreStdDev = count > 1
        ? Number(Math.sqrt(
            individualScores.reduce((sum, s) => sum + (s.total - avgTotal) ** 2, 0) / count
          ).toFixed(2))
        : null;

      return {
        ...beer,
        index,
        ratingCount: count,
        totalScore,
        averageScore: count > 0 ? Number((totalScore / count).toFixed(2)) : 0,
        maxScorePossible: maxPossiblePerPerson,
        scorePercentage: count > 0 ? Math.round((totalScore / (count * maxPossiblePerPerson)) * 100) : 0,
        averageCategories: count > 0 ? {
          aroma: Number((categories.aroma / count).toFixed(1)),
          appearance: Number((categories.appearance / count).toFixed(1)),
          taste: Number((categories.taste / count).toFixed(1)),
          overall: Number((categories.overall / count).toFixed(1))
        } : null,
        scoreStdDev,
        individualScores,
      };
    });

    // 5. Sort by Average Score Descending (with stable tiebreaker by name)
    aggregated.sort((a, b) => b.averageScore - a.averageScore || a.name.localeCompare(b.name));

    // Beer-level superlatives — mirrors the taster superlatives below, but
    // asks "how much did tasters disagree on this beer" instead of "how
    // consistent was this person".
    const divisiveCandidates = aggregated.filter(b => b.ratingCount >= 2 && b.scoreStdDev !== null);
    let beerSuperlatives: { mostDivisive: { name: string; value: number }; mostUnanimous: { name: string; value: number } } | null = null;
    if (divisiveCandidates.length >= 2) {
      const byStdDevDesc = [...divisiveCandidates].sort((a, b) => (b.scoreStdDev! - a.scoreStdDev!) || a.name.localeCompare(b.name));
      const mostDivisive = byStdDevDesc[0];
      const mostUnanimous = byStdDevDesc[byStdDevDesc.length - 1];
      beerSuperlatives = {
        mostDivisive: { name: mostDivisive.name, value: mostDivisive.scoreStdDev! },
        mostUnanimous: { name: mostUnanimous.name, value: mostUnanimous.scoreStdDev! },
      };
    }

    // 6. Compute per-taster insights
    const tasterInsights = allRatings
      .filter((r): r is UserRatingData => r !== null && r.ratings !== undefined)
      .map((userRatingData) => {
        const userName = userRatingData.userName;
        const beerTotals: { beerName: string; beerIndex: number; total: number }[] = [];
        const allScores: number[] = [];
        const categoryTotals = { aroma: 0, appearance: 0, taste: 0, overall: 0 };
        let ratedCount = 0;

        beers.forEach((beer: BeerInput, index: number) => {
          const rawRating = userRatingData.ratings[index];
          if (rawRating) {
            const rating = safeRating(rawRating as unknown as Record<string, unknown>);
            const total = rating.aroma + rating.appearance + rating.taste + rating.overall;
            beerTotals.push({ beerName: beer.name, beerIndex: index, total });
            allScores.push(total);
            categoryTotals.aroma += rating.aroma;
            categoryTotals.appearance += rating.appearance;
            categoryTotals.taste += rating.taste;
            categoryTotals.overall += rating.overall;
            ratedCount++;
          }
        });

        if (ratedCount === 0) return null;

        const avgGiven = Number((allScores.reduce((s, v) => s + v, 0) / ratedCount).toFixed(2));

        // Standard deviation
        const mean = avgGiven;
        const variance = allScores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / ratedCount;
        const stdDev = Number(Math.sqrt(variance).toFixed(2));

        // Favourite & least favourite
        beerTotals.sort((a, b) => b.total - a.total || a.beerName.localeCompare(b.beerName));
        const favouriteBeer = beerTotals[0];
        const leastFavouriteBeer = beerTotals[beerTotals.length - 1];

        // Did they agree with the group winner?
        const groupWinnerIndex = aggregated[0]?.index;
        const theirTopIndex = favouriteBeer?.beerIndex;
        const agreedWithWinner = groupWinnerIndex === theirTopIndex;

        // Average category scores
        const avgCategories = {
          aroma: Number((categoryTotals.aroma / ratedCount).toFixed(1)),
          appearance: Number((categoryTotals.appearance / ratedCount).toFixed(1)),
          taste: Number((categoryTotals.taste / ratedCount).toFixed(1)),
          overall: Number((categoryTotals.overall / ratedCount).toFixed(1)),
        };

        // Score each archetype across multiple independent signals.
        // Every archetype accumulates points from continuous signals so that
        // most users don't all fall into the same bucket.

        // Helper: normalise a value into [0, 1] given expected range
        const norm = (v: number, lo: number, hi: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));

        // Category spread: how much did they favour one category over others?
        const catVals = [avgCategories.aroma, avgCategories.appearance, avgCategories.taste, avgCategories.overall];
        const catMax = Math.max(...catVals);
        const catMin = Math.min(...catVals);
        const catSpread = catMax - catMin; // 0 = uniform, ~2 = strong preference

        // Per-category z-score relative to this person's own mean
        const catMean = catVals.reduce((a, b) => a + b, 0) / 4;
        const aromaZ  = avgCategories.aroma       - catMean;
        const lookZ   = avgCategories.appearance  - catMean;
        const tasteZ  = avgCategories.taste       - catMean;
        const vibesZ  = avgCategories.overall     - catMean;

        // Score spread: gap between their best and worst beer rating
        const scoreSpread = allScores.length > 1
          ? Math.max(...allScores) - Math.min(...allScores)
          : 0;

        const archetypeScores: Record<string, number> = {
          // Tightened: needs avg ≥ 15 AND very low variance (σ < 2) → true peacekeepers only
          'The Diplomat':
            norm(avgGiven, 15, 20) * 4 +
            (1 - norm(stdDev, 0, 2)) * 4 +
            (agreedWithWinner ? 1 : 0),

          // Tightened: needs avg ≤ 12 AND very low variance → genuine tough crowd only
          'The Perfectionist':
            (1 - norm(avgGiven, 0, 12)) * 4 +
            (1 - norm(stdDev, 0, 2)) * 4 +
            (1 - norm(scoreSpread, 0, 10)),

          // High variance + contrarian pick → chaos agent
          'The Contrarian':
            norm(stdDev, 2, 6) * 4 +
            norm(scoreSpread, 4, 18) * 2 +
            (!agreedWithWinner ? 2 : 0),

          // Very high scores overall → life of the party
          'The Cheerleader':
            norm(avgGiven, 14, 20) * 5 +
            (agreedWithWinner ? 1 : 0),

          // Very low scores → the floor manager of taste
          'The Critic':
            (1 - norm(avgGiven, 0, 16)) * 4 +
            (1 - norm(stdDev, 0, 5)) * 2,

          // Aroma distinctly highest relative to own mean
          'The Nose':
            norm(aromaZ, 0, 2) * 4 +
            norm(catSpread, 0.3, 2) * 2,

          // Appearance distinctly highest
          'The Aesthete':
            norm(lookZ, 0, 2) * 4 +
            norm(catSpread, 0.3, 2) * 2,

          // Taste clearly dominant with meaningful category spread
          'The Sommelier':
            norm(tasteZ, 0.3, 2) * 4 +
            norm(catSpread, 0.5, 2) * 2,

          // Vibes/overall highest
          'The Vibes Guru':
            norm(vibesZ, 0, 2) * 4 +
            norm(catSpread, 0.3, 2) * 2,

          // Knows their beer, agreed with crowd consensus, reasonably consistent
          'The Aficionado':
            norm(avgGiven, 12, 17) * 2 +
            (agreedWithWinner ? 3 : 0) +
            (1 - norm(stdDev, 0, 4)) * 2,

          // Big gap between their best and worst beer — very discerning, has opinions
          'The Hawk':
            norm(scoreSpread, 6, 18) * 5 +
            (1 - norm(avgGiven, 12, 20)) * 2,

          // Mid-high avg, vibes/overall distinctly high — social, atmosphere-led drinker
          'The Bon Vivant':
            norm(avgGiven, 12, 18) * 2 +
            norm(vibesZ, 0.2, 2) * 4 +
            norm(catSpread, 0.3, 2) * 2,

          // Both aroma AND taste above their own mean — sensory driven holistically
          'The Sensualist':
            (aromaZ > 0 ? norm(aromaZ, 0, 2) * 3 : 0) +
            (tasteZ > 0 ? norm(tasteZ, 0, 2) * 3 : 0) +
            norm(catSpread, 0.3, 2) * 2,

          // Truly balanced — not high, not low, not opinionated
          'The Taster':
            (1 - norm(Math.abs(avgGiven - 13), 0, 7)) * 2 +
            (1 - norm(stdDev, 0, 5)) * 1,
        };

        return {
          userName,
          averageGiven: avgGiven,
          stdDeviation: stdDev,
          favouriteBeer: favouriteBeer ? { name: favouriteBeer.beerName, score: favouriteBeer.total } : null,
          leastFavouriteBeer: leastFavouriteBeer ? { name: leastFavouriteBeer.beerName, score: leastFavouriteBeer.total } : null,
          agreedWithWinner,
          archetypeScores,
          avgCategories,
          beersRated: ratedCount,
        };
      })
      .filter(Boolean);

    // Session-level archetype assignment: takes every taster's full score
    // vector and spreads distinct archetypes across the group where honestly
    // possible, instead of each taster picking their raw independent argmax
    // (see assignArchetypes for the fairness rules).
    const rawInsights = tasterInsights.filter(Boolean) as NonNullable<typeof tasterInsights[number]>[];
    const archetypeAssignment = assignArchetypes(
      rawInsights.map(t => ({ userName: t.userName, scores: t.archetypeScores }))
    );
    const validInsights = rawInsights.map(({ archetypeScores, ...rest }) => ({
      ...rest,
      archetype: archetypeAssignment[rest.userName],
    }));

    // Superlatives
    let superlatives = null;
    if (validInsights.length >= 2) {
      const sorted = [...validInsights];

      const mostConsistent = [...sorted].sort((a, b) => a!.stdDeviation - b!.stdDeviation)[0];
      const wildcard = [...sorted].sort((a, b) => b!.stdDeviation - a!.stdDeviation)[0];
      const generous = [...sorted].sort((a, b) => b!.averageGiven - a!.averageGiven)[0];
      const harsh = [...sorted].sort((a, b) => a!.averageGiven - b!.averageGiven)[0];
      const agreedCount = sorted.filter(t => t!.agreedWithWinner).length;

      superlatives = {
        mostConsistent: { userName: mostConsistent!.userName, value: mostConsistent!.stdDeviation },
        wildcard: { userName: wildcard!.userName, value: wildcard!.stdDeviation },
        generous: { userName: generous!.userName, value: generous!.averageGiven },
        harsh: { userName: harsh!.userName, value: harsh!.averageGiven },
        agreedWithWinnerCount: agreedCount,
        totalTasters: sorted.length,
      };
    }
    
    return NextResponse.json({
      session: sessionData,
      participantsCount: participants.length,
      participants,
      results: aggregated,
      tasterInsights: validInsights,
      superlatives,
      beerSuperlatives,
    });
    
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to aggregate results' }, { status: 500 });
  }
}

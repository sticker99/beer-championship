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
        individualScores,
      };
    });
    
    // 5. Sort by Average Score Descending (with stable tiebreaker by name)
    aggregated.sort((a, b) => b.averageScore - a.averageScore || a.name.localeCompare(b.name));

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
          // Consistent + generous → Diplomat
          'The Diplomat':
            norm(avgGiven, 12, 20) * 3 +
            (1 - norm(stdDev, 0, 4)) * 3 +
            (agreedWithWinner ? 1 : 0),

          // Consistent + tough → Perfectionist
          'The Perfectionist':
            (1 - norm(avgGiven, 0, 20)) * 3 +
            (1 - norm(stdDev, 0, 4)) * 3 +
            (1 - norm(scoreSpread, 0, 15)),

          // High variance, goes against the grain → Contrarian
          'The Contrarian':
            norm(stdDev, 2, 6) * 4 +
            norm(scoreSpread, 4, 18) * 2 +
            (!agreedWithWinner ? 2 : 0),

          // Very high scores across the board → Cheerleader
          'The Cheerleader':
            norm(avgGiven, 14, 20) * 5 +
            (agreedWithWinner ? 1 : 0),

          // Very low scores + some consistency → Critic
          'The Critic':
            (1 - norm(avgGiven, 0, 16)) * 4 +
            (1 - norm(stdDev, 0, 5)) * 2,

          // Aroma distinctly highest → The Nose
          'The Nose':
            norm(aromaZ, 0, 2) * 4 +
            norm(catSpread, 0.3, 2) * 2,

          // Appearance distinctly highest → Aesthete
          'The Aesthete':
            norm(lookZ, 0, 2) * 4 +
            norm(catSpread, 0.3, 2) * 2,

          // Taste clearly dominant (raised floor to avoid it being the default) → Sommelier
          'The Sommelier':
            norm(tasteZ, 0.3, 2) * 4 +
            norm(catSpread, 0.5, 2) * 2,

          // Vibes/overall highest → Vibes Guru
          'The Vibes Guru':
            norm(vibesZ, 0, 2) * 4 +
            norm(catSpread, 0.3, 2) * 2,

          // Middle of the road on everything → Taster
          'The Taster':
            (1 - norm(Math.abs(avgGiven - 13), 0, 7)) * 2 +
            (1 - norm(stdDev, 0, 5)) * 1,
        };

        const archetype = Object.entries(archetypeScores)
          .sort((a, b) => b[1] - a[1])[0][0];

        return {
          userName,
          averageGiven: avgGiven,
          stdDeviation: stdDev,
          favouriteBeer: favouriteBeer ? { name: favouriteBeer.beerName, score: favouriteBeer.total } : null,
          leastFavouriteBeer: leastFavouriteBeer ? { name: leastFavouriteBeer.beerName, score: leastFavouriteBeer.total } : null,
          agreedWithWinner,
          archetype,
          avgCategories,
          beersRated: ratedCount,
        };
      })
      .filter(Boolean);

    // Superlatives
    const validInsights = tasterInsights.filter(Boolean) as NonNullable<typeof tasterInsights[number]>[];
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
    });
    
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to aggregate results' }, { status: 500 });
  }
}

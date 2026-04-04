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
        const rating = userRatingData.ratings[index];
        if (rating) {
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
    
    // 5. Sort by Average Score Descending
    aggregated.sort((a, b) => b.averageScore - a.averageScore);

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
          const rating = userRatingData.ratings[index];
          if (rating) {
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
        beerTotals.sort((a, b) => b.total - a.total);
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

        // Highest category preference
        const categoryEntries = Object.entries(avgCategories) as [string, number][];
        categoryEntries.sort((a, b) => b[1] - a[1]);
        const topCategory = categoryEntries[0][0];

        // Archetype based on patterns
        let archetype = 'The Taster';
        if (stdDev <= 1.5 && avgGiven >= 14) archetype = 'The Diplomat';
        else if (stdDev <= 1.5 && avgGiven < 14) archetype = 'The Perfectionist';
        else if (stdDev > 3.5) archetype = 'The Contrarian';
        else if (avgGiven >= 16) archetype = 'The Cheerleader';
        else if (avgGiven <= 10) archetype = 'The Critic';
        else if (topCategory === 'aroma') archetype = 'The Nose';
        else if (topCategory === 'appearance') archetype = 'The Aesthete';
        else if (topCategory === 'taste') archetype = 'The Sommelier';
        else if (topCategory === 'overall') archetype = 'The Vibes Guru';

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

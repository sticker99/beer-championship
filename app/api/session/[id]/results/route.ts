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

    // 4. Aggregate
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
    
    return NextResponse.json({
      session: sessionData,
      participantsCount: participants.length,
      participants,
      results: aggregated
    });
    
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to aggregate results' }, { status: 500 });
  }
}

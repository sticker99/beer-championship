import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { sessionId, userName, ratings } = await request.json();

    if (!sessionId || !userName || !ratings) {
      return NextResponse.json({ error: 'Missing sessionId, userName, or ratings' }, { status: 400 });
    }

    // Save ratings under a key unique to the session and user, and add the
    // user to the session's participant set, in a single atomic-ish write.
    // `ratings` is an object: { [beerIndex]: { aroma, appearance, taste, overall, comment } }
    const ratingKey = `session:${sessionId}:ratings:${userName}`;
    const participantsKey = `session:${sessionId}:participants`;

    await db.submitRating(ratingKey, {
      userName,
      ratings,
      submittedAt: Date.now()
    }, participantsKey, userName);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[rating/submit] failed', error);
    return NextResponse.json({ error: 'Failed to submit ratings. Please try again.' }, { status: 500 });
  }
}

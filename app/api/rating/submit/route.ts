import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { sessionId, userName, ratings } = await request.json();
    
    // Save ratings under a key unique to the session and user
    // `ratings` is an object: { [beerIndex]: { aroma, appearance, taste, overall, comment } }
    const ratingKey = `session:${sessionId}:ratings:${userName}`;
    
    await db.set(ratingKey, {
      userName,
      ratings,
      submittedAt: Date.now()
    });

    // Optionally we can push the user to a set of participants in the session
    await db.sadd(`session:${sessionId}:participants`, userName);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to submit ratings' }, { status: 500 });
  }
}

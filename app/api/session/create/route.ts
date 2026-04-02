import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { name, beers } = await request.json();
    
    // Generate a simple 4 letter code
    const sessionId = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const sessionData = {
      id: sessionId,
      name,
      beers,
      createdAt: Date.now(),
      status: 'active' // active | showdown
    };
    
    await db.set(`session:${sessionId}`, sessionData);
    
    return NextResponse.json({ success: true, sessionId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

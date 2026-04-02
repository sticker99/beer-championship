import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const sessionId = resolvedParams.id.toUpperCase();
    const sessionData = await db.get(`session:${sessionId}`);
    
    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    return NextResponse.json(sessionData);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

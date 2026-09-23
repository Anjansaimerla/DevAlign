import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'DevAlign Full-Stack Engine',
    timestamp: new Date().toISOString(),
  });
}

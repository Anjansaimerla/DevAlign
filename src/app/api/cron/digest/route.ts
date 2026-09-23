import { NextRequest, NextResponse } from 'next/server';
import { runDigestCycle } from '@/lib/server/digestService';

export async function GET(req: NextRequest) {
  try {
    // Verify optional cron secret if configured
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = await runDigestCycle();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (err: any) {
    console.error('Cron digest cycle error:', err);
    return NextResponse.json({ error: 'Failed to run digest cycle', details: err.message }, { status: 500 });
  }
}

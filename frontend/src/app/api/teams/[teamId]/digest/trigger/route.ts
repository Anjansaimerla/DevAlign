import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { generateDigestForTeam } from '@/lib/server/digestService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name')
      .eq('id', teamId)
      .maybeSingle();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const result = await generateDigestForTeam(supabase, team);
    return NextResponse.json({
      success: true,
      message: 'Digest triggered successfully',
      result,
    });
  } catch (err: any) {
    console.error('Manual digest trigger error:', err);
    return NextResponse.json({ error: 'Failed to trigger digest', details: err.message }, { status: 500 });
  }
}

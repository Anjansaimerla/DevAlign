import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { testIntegrationPing } from '@/lib/server/chatDispatcher';

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

    const body = await req.json();
    const { webhook_url, platform } = body || {};

    if (!webhook_url || !platform) {
      return NextResponse.json({ error: 'Missing webhook_url or platform' }, { status: 400 });
    }

    const pingResult = await testIntegrationPing(webhook_url, platform);
    if (!pingResult.success) {
      return NextResponse.json({
        success: false,
        error: pingResult.error || 'Failed to dispatch test message to webhook',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Test ping dispatched successfully to ${platform}!`,
    });
  } catch (err: any) {
    console.error('Integration test error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

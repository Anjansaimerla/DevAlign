import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/server/supabaseAdmin';
import { normalizeEvent } from '@/lib/server/normalizeEvent';

const INGESTED_EVENTS = new Set(['push', 'pull_request', 'issues', 'issue']);

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event') || 'unknown';
  const deliveryId = req.headers.get('x-github-delivery') || null;

  if (!signature) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error('CRITICAL: GITHUB_WEBHOOK_SECRET is not defined in environment variables.');
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  // Read raw body string to verify exact signed bytes
  const rawBody = await req.text();

  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = `sha256=${hmac.update(rawBody).digest('hex')}`;

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const digestBuffer = Buffer.from(digest, 'utf8');

    if (
      signatureBuffer.length !== digestBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, digestBuffer)
    ) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }
  } catch (err) {
    console.error('Signature verification error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  let payload: any = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Immediate response handling + DB persistence
  try {
    if (event === 'ping') {
      console.log('GitHub ping received; webhook is active.');
      return NextResponse.json({ status: 'received', ping: true });
    }

    if (!INGESTED_EVENTS.has(event)) {
      console.log(`Ignoring unsupported event type: ${event}`);
      return NextResponse.json({ status: 'received', ignored: true });
    }

    const supabase = getSupabaseAdmin();

    // Idempotency: skip duplicate deliveries
    if (deliveryId) {
      const { data: existing } = await supabase
        .from('activity_logs')
        .select('id')
        .eq('delivery_id', deliveryId)
        .maybeSingle();

      if (existing) {
        console.log(`Duplicate delivery ${deliveryId} ignored (idempotent).`);
        return NextResponse.json({ status: 'received', duplicate: true });
      }
    }

    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      return NextResponse.json({ status: 'received', warning: 'Missing repository.full_name' });
    }

    // Map repository -> team
    let repoData: any = null;
    const githubRepoId = payload.repository?.id;
    if (githubRepoId !== undefined && githubRepoId !== null) {
      const byId = await supabase
        .from('repositories')
        .select('team_id')
        .eq('github_repo_id', githubRepoId)
        .maybeSingle();
      repoData = byId.data;
    }
    if (!repoData) {
      const byName = await supabase
        .from('repositories')
        .select('team_id')
        .eq('repo_name', repoFullName)
        .maybeSingle();
      repoData = byName.data;
    }

    if (!repoData) {
      console.warn(`Repository ${repoFullName} is not registered; event dropped.`);
      return NextResponse.json({ status: 'received', unregistered_repo: true });
    }

    const normalized = normalizeEvent(event, payload);
    const { error: insertError } = await (supabase.from('activity_logs') as any).insert({
      team_id: repoData.team_id,
      event_type: event,
      actor_github_username: normalized.actor,
      payload_summary: normalized,
      delivery_id: deliveryId,
    });

    if (insertError && insertError.code !== '23505') {
      console.error('Activity log insert failed:', insertError);
    }

    console.log(`Logged ${event} event for team ${repoData.team_id}.`);
    return NextResponse.json({ status: 'received', delivery_id: deliveryId });
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return NextResponse.json({ status: 'received', error: err.message });
  }
}

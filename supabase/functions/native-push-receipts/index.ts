import {
  authenticateServiceRole,
  corsHeaders,
  isResponse,
  jsonResponse,
} from '../_shared/native.ts';

const MAX_RECEIPT_BATCH = 100;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const adminClient = await authenticateServiceRole(request);
  if (isResponse(adminClient)) return adminClient;

  const { data: pending, error: pendingError } = await adminClient
    .from('native_call_push_deliveries')
    .select('expo_ticket_id')
    .eq('status', 'provider_ticketed')
    .not('expo_ticket_id', 'is', null)
    .lte('updated_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    .limit(MAX_RECEIPT_BATCH);
  if (pendingError) return jsonResponse(500, { error: 'Could not load pending Expo receipts' });

  const ticketIds = [...new Set((pending ?? [])
    .map((delivery) => delivery.expo_ticket_id)
    .filter((ticketId): ticketId is string => typeof ticketId === 'string'))];
  if (ticketIds.length === 0) return jsonResponse(200, { processed: 0 });
  const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (!expoAccessToken) return jsonResponse(503, { error: 'Expo push credentials are not configured' });

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expoAccessToken}`,
      },
      body: JSON.stringify({ ids: ticketIds }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return jsonResponse(502, { error: 'Expo receipt lookup failed' });

    const result: unknown = await response.json();
    const receiptMap = typeof result === 'object' && result !== null && 'data' in result
      && typeof result.data === 'object' && result.data !== null
      ? result.data as Record<string, unknown>
      : {};
    const receipts = Object.entries(receiptMap).map(([id, receipt]) =>
      typeof receipt === 'object' && receipt !== null
        ? { ...receipt, id }
        : { id, status: 'error' },
    );
    const { data: applied, error } = await adminClient.rpc('native_apply_expo_receipts', {
      p_receipts: receipts,
    });
    if (error) return jsonResponse(500, { error: 'Could not persist Expo push receipts' });
    return jsonResponse(200, { processed: applied ?? 0 });
  } catch {
    return jsonResponse(502, { error: 'Expo receipt lookup failed' });
  }
});

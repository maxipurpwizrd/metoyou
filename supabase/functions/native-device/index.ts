import {
  authenticateUser,
  corsHeaders,
  isRecord,
  isResponse,
  isValidUuid,
  isExpoPushToken,
  jsonResponse,
} from '../_shared/native.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const auth = await authenticateUser(request);
  if (isResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }
  if (!isRecord(body) || typeof body.action !== 'string') {
    return jsonResponse(400, { error: 'A valid action is required' });
  }

  if (body.action === 'prepare') {
    if (!isValidUuid(body.installationId)
      || (body.previousExpoPushToken !== undefined && body.previousExpoPushToken !== null
        && !isExpoPushToken(body.previousExpoPushToken))) {
      return jsonResponse(400, { error: 'Invalid device reassignment proof' });
    }
    const { error } = await auth.adminClient.rpc('native_prepare_push_device', {
      p_user_id: auth.user.id,
      p_installation_id: body.installationId,
      p_previous_expo_push_token: body.previousExpoPushToken ?? null,
    });
    if (error) return jsonResponse(503, { error: 'Could not prepare this installation' });
    return jsonResponse(200, { ok: true });
  }

  if (body.action === 'register') {
    if (!isValidUuid(body.installationId) || !isExpoPushToken(body.expoPushToken)
      || (body.platform !== 'android' && body.platform !== 'ios')
      || (body.previousExpoPushToken !== undefined && body.previousExpoPushToken !== null
        && !isExpoPushToken(body.previousExpoPushToken))) {
      return jsonResponse(400, { error: 'Invalid native device registration' });
    }

    const { error } = await auth.adminClient.rpc('native_register_push_device', {
      p_user_id: auth.user.id,
      p_installation_id: body.installationId,
      p_expo_push_token: body.expoPushToken,
      p_platform: body.platform,
      p_previous_expo_push_token: body.previousExpoPushToken ?? null,
    });
    if (error) return jsonResponse(503, { error: 'Could not register this device for native push' });
    return jsonResponse(200, { ok: true });
  }

  if (body.action === 'revoke') {
    if (!isValidUuid(body.installationId)) {
      return jsonResponse(400, { error: 'Invalid installation ID' });
    }
    const { error } = await auth.adminClient.rpc('native_revoke_push_device', {
      p_user_id: auth.user.id,
      p_installation_id: body.installationId,
    });
    if (error) return jsonResponse(503, { error: 'Could not revoke this device registration' });
    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(400, { error: 'Unsupported device action' });
});

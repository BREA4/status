import { json } from '@sveltejs/kit';
import { authorizedCron } from '#lib/server/cron.ts';
import { getFeatures } from '#lib/server/features.ts';
import { getSnapshot } from '#lib/server/monitor.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!authorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  const features = await getFeatures();
  const snapshot = await getSnapshot(features.enabledServiceIds, { fresh: true });
  const recorded = snapshot.historyRecording === 'recorded';
  return json(
    {
      ok: recorded,
      generatedAt: snapshot.generatedAt,
      historyRecording: snapshot.historyRecording
    },
    {
      status: recorded ? 200 : 503,
      headers
    }
  );
};

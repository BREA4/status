import { json } from '@sveltejs/kit';
import { getSnapshot } from '#lib/server/monitor.ts';
export async function GET() {
  return json(await getSnapshot(), {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' }
  });
}

import { json } from '@sveltejs/kit';
import { readPublishedSnapshot } from '#lib/server/published.ts';
import type { RequestHandler } from './$types';

export const prerender = true;
export const GET: RequestHandler = ({ locals }) =>
  json(readPublishedSnapshot(locals.features.enabledServiceIds));

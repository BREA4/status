import { readFileSync } from 'node:fs';
import { emptySnapshot, snapshotSchema, type Snapshot } from '#lib/status.ts';
import { historySchema } from './history';
import seed from '../../data/history-seed.json';

export function readPublishedSnapshot(enabledServiceIds: string[]): Snapshot {
  let snapshot: Snapshot;
  try {
    // ASVS 2.2.1, 2.2.2: validate the collector's public contract before prerendering.
    snapshot = snapshotSchema.parse(JSON.parse(readFileSync('.monitoring/status.json', 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    snapshot = emptySnapshot();
    const history = historySchema.parse(seed);
    for (const component of snapshot.components) {
      component.history = history.components.find(({ id }) => id === component.id)?.history ?? [];
    }
  }
  const enabled = new Set(enabledServiceIds);
  return {
    ...snapshot,
    components: snapshot.components.filter(({ id }) => enabled.has(id)),
    incidents: snapshot.incidents.flatMap((incident) => {
      if (!enabled.size) return [];
      if (!incident.components.length) return [incident];
      const components = incident.components.filter((id) => enabled.has(id));
      return components.length ? [{ ...incident, components }] : [];
    })
  };
}

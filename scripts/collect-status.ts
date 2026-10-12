import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { collectSnapshot } from '../src/lib/server/collector';
import { getFeatures } from '../src/lib/server/features';
import { createFileHistoryStore } from '../src/lib/server/file-history-store';
import { recordHistory } from '../src/lib/server/history';
import { snapshotSchema } from '../src/lib/status';

const { values } = parseArgs({
  options: {
    history: { type: 'string', default: '.monitoring/history.json' },
    output: { type: 'string', default: '.monitoring/status.json' }
  },
  strict: true
});
try {
  const store = createFileHistoryStore(values.history!);
  // Validate existing history before probing; an unreadable store must fail the deployment.
  await store.read();
  const features = await getFeatures();
  // ASVS 13.3.1: feed secrets stay in the runner environment and never enter build inputs.
  const snapshot = await recordHistory(
    await collectSnapshot(
      {
        STATUS_FEED_URL: process.env.STATUS_FEED_URL,
        STATUS_FEED_TOKEN: process.env.STATUS_FEED_TOKEN
      },
      fetch,
      features.enabledServiceIds
    ),
    store
  );
  if (snapshot.historyRecording !== 'recorded') throw new Error('History was not saved');
  mkdirSync(dirname(values.output!), { recursive: true });
  writeFileSync(values.output!, JSON.stringify(snapshotSchema.parse(snapshot), null, 2) + '\n');
  console.info(`Published ${snapshot.components.length} observations at ${snapshot.generatedAt}`);
} catch {
  // ASVS 16.5.1: no upstream bodies, file contents, secrets, or exceptions in runner logs.
  console.error('Status collection failed; the existing deployment and history are preserved.');
  process.exitCode = 1;
}

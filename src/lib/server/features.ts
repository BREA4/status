import { readFileSync } from 'node:fs';
import values from '../../data/features.json';
import { featuresFromValues, type Features } from '#lib/features.ts';

function readConfiguredFeatures(): Record<string, unknown> {
  // Operator-only build configuration. No file paths or credentials come from visitors.
  return process.env.STATUS_FEATURES_FILE
    ? JSON.parse(readFileSync(process.env.STATUS_FEATURES_FILE, 'utf8'))
    : values;
}

export async function getFeatures(
  readFlags: () =>
    Record<string, unknown> | Promise<Record<string, unknown>> = readConfiguredFeatures
): Promise<Features> {
  // ASVS 2.2.1, 16.5.3: reject unreadable build configuration instead of publishing defaults.
  return featuresFromValues(await readFlags());
}

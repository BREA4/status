import { expect, test } from 'bun:test';
import { componentIds } from '../src/lib/catalog';
import { featureDefinitions, serviceFlagKey } from '../src/lib/features';
import { getFeatures } from '../src/lib/server/features';

test('missing credentials and provider failures preserve services and appearance, with support hidden', async () => {
  for (const readFlags of [
    async () => ({}),
    async () => {
      throw new Error('Unavailable');
    }
  ]) {
    expect(await getFeatures(readFlags)).toEqual({
      supportEnabled: false,
      themeEnabled: true,
      enabledServiceIds: componentIds
    });
  }
});

test('every trackable component has an independent flag', async () => {
  expect(new Set(featureDefinitions.map(({ key }) => key)).size).toBe(componentIds.length + 2);
  for (const id of componentIds) {
    const features = await getFeatures(async () => ({ [serviceFlagKey(id)]: false }));
    expect(features.enabledServiceIds).toEqual(
      componentIds.filter((candidate) => candidate !== id)
    );
  }
});

test('the appearance flag is independent of services and contact support', async () => {
  expect(
    await getFeatures(async () => ({ 'theme-selector': false, 'contact-support': true }))
  ).toEqual({
    supportEnabled: true,
    themeEnabled: false,
    enabledServiceIds: componentIds
  });
});

test('invalid provider values use boolean defaults instead of truthiness', async () => {
  expect(
    await getFeatures(async () => ({
      'theme-selector': 'false',
      'contact-support': 'true',
      'service-website': null,
      'service-login': 0,
      'service-update-server': false
    }))
  ).toEqual({
    supportEnabled: false,
    themeEnabled: true,
    enabledServiceIds: componentIds.filter((id) => id !== 'update-server')
  });
});

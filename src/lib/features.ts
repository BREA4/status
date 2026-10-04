import { groups } from './catalog';

export const serviceFlagKey = (id: string) => `service-${id}`;
export const featureDefinitions = [
  {
    key: 'contact-support',
    description: 'Show the contact support card to all status page visitors',
    defaultValue: false
  },
  {
    key: 'theme-selector',
    description: 'Allow appearance selection; when off, use the light theme for all visitors',
    defaultValue: true
  },
  ...groups.flatMap((group) =>
    group.components.map((component) => ({
      key: serviceFlagKey(component.id),
      description: `Monitor and show ${group.name.en}: ${component.name.en} on the status page`,
      defaultValue: true
    }))
  )
];

export interface Features {
  supportEnabled: boolean;
  themeEnabled: boolean;
  enabledServiceIds: string[];
}

export function featuresFromValues(values: Record<string, unknown> = {}): Features {
  // ASVS 2.2.1: accept only booleans from the provider; use defined defaults otherwise.
  const enabled = (key: string) => {
    const value = values[key];
    return typeof value === 'boolean'
      ? value
      : featureDefinitions.find((flag) => flag.key === key)!.defaultValue;
  };
  return {
    supportEnabled: enabled('contact-support'),
    themeEnabled: enabled('theme-selector'),
    enabledServiceIds: groups.flatMap((group) =>
      group.components.filter(({ id }) => enabled(serviceFlagKey(id))).map(({ id }) => id)
    )
  };
}

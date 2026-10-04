import type { Locale } from '#lib/i18n.ts';
import type { Features } from '#lib/features.ts';
declare global {
  namespace App {
    interface Locals {
      locale: Locale;
      features: Features;
    }
  }
}
export {};

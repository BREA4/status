import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function mountMotion(root: HTMLElement) {
  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();
  media.add(
    '(prefers-reduced-motion: no-preference)',
    () => {
      // Compact card stacking on entry; contents remain in normal document flow.
      gsap.from('.service-group', {
        y: 16,
        stagger: 0.07,
        duration: 0.55,
        ease: 'power2.out',
        scrollTrigger: { trigger: '.service-list', start: 'top 95%', once: true }
      });
    },
    root
  );
  media.add(
    '(min-width: 1100px) and (prefers-reduced-motion: no-preference)',
    () => {
      ScrollTrigger.create({
        trigger: '.services-aside',
        start: 'top 100px',
        endTrigger: '.services-main',
        // Stop when the sidebar's bottom reaches the end of the service list.
        end: () =>
          `bottom ${100 + root.querySelector<HTMLElement>('.services-aside')!.offsetHeight}px`,
        pin: '.services-aside',
        pinSpacing: false,
        invalidateOnRefresh: true
      });
    },
    root
  );
  return { refresh: () => ScrollTrigger.refresh(), destroy: () => media.revert() };
}

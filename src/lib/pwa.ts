interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let installEvent: InstallEvent | null = null;
let update: (() => Promise<void>) | null = null;
let state = { installed: false, installAvailable: false, updateAvailable: false };
const listeners = new Set<() => void>();
const publish = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
export const getPwaState = () => state;
export const subscribePwa = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setupPwa() {
  publish({ installed: window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone) });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event as InstallEvent; publish({ installAvailable: true }); });
  window.addEventListener('appinstalled', () => { installEvent = null; publish({ installed: true, installAvailable: false }); });
}
export function offerPwaUpdate(callback: () => Promise<void>) { update = callback; publish({ updateAvailable: true }); }
export async function applyPwaUpdate() { await update?.(); }
export async function installPwa(): Promise<'accepted' | 'dismissed' | 'manual' | 'installed'> {
  if (state.installed) return 'installed';
  if (!installEvent) return 'manual';
  const event = installEvent; installEvent = null; publish({ installAvailable: false });
  await event.prompt(); return (await event.userChoice).outcome;
}

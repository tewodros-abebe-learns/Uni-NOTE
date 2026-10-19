let warning: string | null = null;
const listeners = new Set<() => void>();
export const getCloudWarning = () => warning;
export const subscribeCloudStatus = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const setCloudWarning = (message: string | null) => { warning = message; listeners.forEach(listener => listener()); };

import { useSyncExternalStore } from 'react';
import { getMediaRevision, subscribeMedia } from '../utils/mediaStore';
export const useMediaRevision = () => useSyncExternalStore(subscribeMedia, getMediaRevision, () => 0);

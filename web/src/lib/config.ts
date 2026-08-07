const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:8788';

// Single seeded channel for now — see worker/src/index.ts.
export const CHANNEL_ID = 'main';

export const SNAPSHOT_URL = `${API_ORIGIN}/channels/${CHANNEL_ID}/snapshot`;
export const WS_URL = `${API_ORIGIN.replace(/^http/, 'ws')}/channels/${CHANNEL_ID}/ws`;

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:8788';

// Defaults to the real channel; ?channel=debug (or any other id) targets a
// different one — e.g. the fast debug preset (see worker/src/presets.ts).
// Every channel is an independently addressed Durable Object, so this is
// the entire mechanism — no separate deployment or environment needed.
export const CHANNEL_ID = new URLSearchParams(window.location.search).get('channel') ?? 'main';

export const SNAPSHOT_URL = `${API_ORIGIN}/channels/${CHANNEL_ID}/snapshot`;
export const WS_URL = `${API_ORIGIN.replace(/^http/, 'ws')}/channels/${CHANNEL_ID}/ws`;
export const START_URL = `${API_ORIGIN}/channels/${CHANNEL_ID}/start`;

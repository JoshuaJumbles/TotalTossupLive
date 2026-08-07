import { useEffect, useState } from 'react';
import type { ChannelSnapshot } from '@total-tossup-live/shared';
import { WS_URL } from './config';

/**
 * Subscribes to the channel's live WebSocket feed. The server sends a full
 * ChannelSnapshot immediately on connect (so a fresh page load or a
 * reconnect after a drop both land in sync with every other viewer, with
 * no separate "catch up" step needed) and again on every phase transition.
 * Reconnects with backoff on drop.
 */
export function useChannelSnapshot() {
  const [snapshot, setSnapshot] = useState<ChannelSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryDelayMs = 500;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (cancelled) return;
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        setConnected(true);
        retryDelayMs = 500;
      };

      socket.onmessage = (event) => {
        setSnapshot(JSON.parse(event.data as string) as ChannelSnapshot);
      };

      socket.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        retryTimer = setTimeout(connect, retryDelayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, 8_000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, []);

  return { snapshot, connected };
}

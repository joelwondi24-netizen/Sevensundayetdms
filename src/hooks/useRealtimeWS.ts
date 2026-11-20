import { useEffect, useRef, useState } from 'react';

export interface WsEventPayload {
  event: string;
  payload: unknown;
}

export function useRealtimeWS(onEvent: (evt: WsEventPayload) => void) {
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      try {
        ws = new WebSocket(url);
        ws.onopen = () => {
          setConnected(true);
        };
        ws.onmessage = (ev) => {
          try {
            const parsed = JSON.parse(String(ev.data)) as WsEventPayload;
            if (parsed?.event === 'presence:count' && typeof (parsed.payload as { count?: number })?.count === 'number') {
              setOnlineUsers((parsed.payload as { count: number }).count);
            }
            if (parsed?.event) {
              callbackRef.current(parsed);
            }
          } catch {
            // ignore malformed frame
          }
        };
        ws.onclose = () => {
          setConnected(false);
          if (!stopped) {
            reconnectTimer = window.setTimeout(connect, 3000);
          }
        };
        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        setConnected(false);
      }
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return { connected, onlineUsers };
}

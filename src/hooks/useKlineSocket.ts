import { useEffect, useRef } from 'react';

export type Kline = { t: number; o: number; h: number; l: number; c: number };

/**
 * Connects to Binance public kline websocket for a symbol and interval.
 * Calls `onKline` with a normalized OHLC object when messages arrive.
 */
export function useKlineSocket(symbol = 'btcusdt', interval = '1m', onKline?: (k: Kline) => void) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!onKline) return;
    const url = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => console.debug('[kline] open', symbol, interval);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (!msg || !msg.k) return;
        const k = msg.k;
        const kline: Kline = {
          t: k.t,
          o: parseFloat(k.o),
          h: parseFloat(k.h),
          l: parseFloat(k.l),
          c: parseFloat(k.c),
        };
        onKline(kline);
      } catch (e) {
        console.warn('[kline] parse error', e);
      }
    };
    ws.onerror = (e) => console.warn('[kline] ws error', e);
    return () => {
      try { ws.close(); } catch {}
      wsRef.current = null;
    };
  }, [symbol, interval, onKline]);
}

export default useKlineSocket;

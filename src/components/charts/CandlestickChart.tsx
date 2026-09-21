"use client";

import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import useKlineSocket, { Kline } from '@/hooks/useKlineSocket';

Chart.register(CandlestickController, CandlestickElement);

type Props = { symbol?: string; interval?: string };

export default function CandlestickChart({ symbol = 'btcusdt', interval = '1m' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any | null>(null);

  const handleKline = (k: Kline) => {
    if (!chartRef.current) return;
    const ds = chartRef.current.data.datasets[0];
    const arr = ds.data as any[];
    const last = arr[arr.length - 1];
    const point = { x: k.t, o: k.o, h: k.h, l: k.l, c: k.c };
    if (last && last.x === point.x) {
      arr[arr.length - 1] = point;
    } else {
      arr.push(point);
      if (arr.length > 200) arr.shift();
    }
    chartRef.current.update('none');
  };

  useKlineSocket(symbol, interval, handleKline);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    chartRef.current = new Chart(ctx, {
      type: 'candlestick',
      data: {
        datasets: [
          {
            label: symbol.toUpperCase(),
            data: [],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            type: 'linear',
            ticks: {
              maxRotation: 0,
              callback: (value) => new Date(Number(value)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          },
          y: { position: 'right' },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [symbol, interval]);

  return (
    <div className="w-full h-80 bg-card p-2 rounded-md">
      <canvas ref={canvasRef} />
    </div>
  );
}

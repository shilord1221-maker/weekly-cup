'use client';

import { useEffect, useState } from 'react';

const GRID = 5;
const adjacency: Record<number, number[]> = {};
for (let i = 0; i < GRID * GRID; i++) {
  const row = Math.floor(i / GRID);
  const col = i % GRID;
  const n: number[] = [];
  if (row > 0) n.push(i - GRID);
  if (row < GRID - 1) n.push(i + GRID);
  if (col > 0) n.push(i - 1);
  if (col < GRID - 1) n.push(i + 1);
  adjacency[i] = n;
}

const sequences = [
  { sel: [6, 7, 11, 12], fin: 7 },
  { sel: [11, 12, 17, 16], fin: 12 },
  { sel: [6, 7, 8, 13], fin: 7 },
  { sel: [12, 13, 18, 17], fin: 13 },
];

export function ZoneAnimation() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setStep((s) => (s + 1) % sequences.length), 2200);
    return () => clearInterval(interval);
  }, []);

  const { sel, fin } = sequences[step];
  const selSet = new Set(sel);
  const adjSet = new Set<number>();
  sel.forEach((s) => (adjacency[s] || []).forEach((n) => !selSet.has(n) && adjSet.add(n)));

  return (
    <div className="absolute right-7 bottom-7">
      <div className="grid grid-cols-5 gap-0.5" style={{ width: 140 }}>
        {Array.from({ length: 25 }, (_, i) => {
          let bg = 'rgba(255,255,255,.03)';
          let border = 'rgba(255,255,255,.05)';
          let shadow = 'none';
          if (i === fin) {
            bg = 'rgba(139,92,246,.35)';
            border = 'rgba(139,92,246,.6)';
            shadow = '0 0 8px rgba(139,92,246,.3)';
          } else if (selSet.has(i)) {
            bg = 'rgba(79,127,255,.22)';
            border = 'rgba(79,127,255,.45)';
          } else if (adjSet.has(i)) {
            bg = 'rgba(79,127,255,.07)';
            border = 'rgba(79,127,255,.18)';
          }
          return (
            <div
              key={i}
              className="aspect-square rounded-sm transition-all duration-300"
              style={{ background: bg, border: `1px solid ${border}`, boxShadow: shadow }}
            />
          );
        })}
      </div>
      <div className="flex gap-3 mt-2 flex-wrap">
        <Legend color="rgba(79,127,255,.25)" label="Выбрана" />
        <Legend color="rgba(139,92,246,.35)" label="Финальная" />
        <Legend color="rgba(79,127,255,.07)" label="Доступна" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--muted)' }}>
      <div className="w-[7px] h-[7px] rounded-sm" style={{ background: color, width: 7, height: 7 }} />
      {label}
    </div>
  );
}

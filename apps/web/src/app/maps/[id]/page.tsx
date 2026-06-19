'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Zone {
  id: string;
  name: string;
  adjacentIds: string[];
  coordinates: { row: number; col: number } | null;
}
interface MapDetail {
  id: string;
  name: string;
  imageUrl: string;
  zones: Zone[];
}

export default function MapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const { data: map, isLoading } = useQuery<MapDetail>({
    queryKey: ['map', id],
    queryFn: () => api.get(`/maps/${id}`, { auth: false }),
    enabled: !!id,
  });

  if (isLoading || !map) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>Загрузка карты...</p>
      </div>
    );
  }

  const gridSize = Math.round(Math.sqrt(map.zones.length)) || 5;
  const hoveredZoneData = map.zones.find((z) => z.id === hoveredZone);

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        {map.name}
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
        Наведите на зону, чтобы увидеть её соседей по графу (adjacencyMap).
      </p>

      <div className="grid gap-1.5 mb-6" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
        {map.zones.map((zone) => {
          const isHovered = hoveredZone === zone.id;
          const isNeighbor = hoveredZoneData?.adjacentIds.includes(zone.id);
          return (
            <button
              key={zone.id}
              onMouseEnter={() => setHoveredZone(zone.id)}
              onMouseLeave={() => setHoveredZone(null)}
              className="aspect-square rounded-md flex items-center justify-center text-center p-1 transition-all"
              style={{
                background: isHovered ? 'rgba(79,127,255,.3)' : isNeighbor ? 'rgba(139,92,246,.18)' : 'rgba(255,255,255,.03)',
                border: `1px solid ${isHovered ? 'rgba(79,127,255,.6)' : isNeighbor ? 'rgba(139,92,246,.4)' : 'rgba(255,255,255,.06)'}`,
              }}
            >
              <span className="text-[9px] leading-tight" style={{ color: isHovered || isNeighbor ? 'var(--text)' : 'var(--muted)' }}>
                {zone.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs" style={{ color: 'var(--muted)' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(79,127,255,.3)' }} /> Зона под курсором
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(139,92,246,.18)' }} /> Смежные зоны
        </span>
      </div>
    </div>
  );
}

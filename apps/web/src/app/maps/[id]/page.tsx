'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ZoneMapSelector } from '@/components/ZoneMapSelector';

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

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-2" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        {map.name}
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
        Наведите на зону, чтобы увидеть её соседей по графу (adjacencyMap).
      </p>

      <ZoneMapSelector imageUrl={map.imageUrl} zones={map.zones} selectedIds={[]} interactive={false} />

      <div className="flex gap-4 text-xs mt-4" style={{ color: 'var(--muted)' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(255,255,255,.06)' }} /> Граница зоны
        </span>
      </div>
    </div>
  );
}

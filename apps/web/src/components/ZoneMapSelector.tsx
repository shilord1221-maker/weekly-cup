'use client';

import { useState } from 'react';

interface Zone {
  id: string;
  name: string;
  adjacentIds: string[];
  coordinates?: { row: number; col: number } | null;
}

interface ZoneMapSelectorProps {
  imageUrl: string;
  zones: Zone[];
  selectedIds: string[];
  finalZoneId?: string | null;
  /** Если true — клик переключает выбор; если false — компонент только для просмотра */
  interactive?: boolean;
  onToggleZone?: (zoneId: string) => void;
  isZoneAvailable?: (zoneId: string) => boolean;
}

/**
 * Интерактивная карта зон — зоны отображаются как кликабельная сетка прямо
 * над изображением карты, с подсветкой при наведении и явным состоянием выбора.
 * Координаты зон берутся из БД (Zone.coordinates: {row, col}), сетка считается автоматически.
 */
export function ZoneMapSelector({
  imageUrl,
  zones,
  selectedIds,
  finalZoneId,
  interactive = false,
  onToggleZone,
  isZoneAvailable,
}: ZoneMapSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const maxRow = Math.max(...zones.map((z) => z.coordinates?.row ?? 0)) + 1;
  const maxCol = Math.max(...zones.map((z) => z.coordinates?.col ?? 0)) + 1;

  const hoveredZone = zones.find((z) => z.id === hoveredId);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ border: '1px solid var(--border2)' }}>
      {/* Изображение карты — основа */}
      <img src={imageUrl} alt="Карта" className="w-full h-auto block" style={{ aspectRatio: `${maxCol} / ${maxRow}`, objectFit: 'cover' }} />

      {/* Сетка зон поверх изображения */}
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${maxCol}, 1fr)`, gridTemplateRows: `repeat(${maxRow}, 1fr)` }}
      >
        {zones.map((zone) => {
          const isSelected = selectedIds.includes(zone.id);
          const isFinal = zone.id === finalZoneId;
          const isHovered = hoveredId === zone.id;
          const isAdjacentToHovered = hoveredZone ? hoveredZone.adjacentIds.includes(zone.id) : false;
          const available = isZoneAvailable ? isZoneAvailable(zone.id) : true;

          let bg = 'transparent';
          let border = '1px solid rgba(255,255,255,0.08)';
          if (isFinal) {
            bg = 'rgba(139,92,246,.45)';
            border = '2px solid rgba(139,92,246,.8)';
          } else if (isSelected) {
            bg = 'rgba(79,127,255,.35)';
            border = '2px solid rgba(79,127,255,.7)';
          } else if (isHovered) {
            bg = 'rgba(79,127,255,.18)';
            border = '1px solid rgba(79,127,255,.5)';
          } else if (isAdjacentToHovered) {
            bg = 'rgba(255,255,255,.06)';
          } else if (!available && interactive) {
            bg = 'rgba(0,0,0,.35)';
          }

          const clickable = interactive && (available || isSelected);

          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => clickable && onToggleZone?.(zone.id)}
              onMouseEnter={() => setHoveredId(zone.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative flex items-end justify-center p-1.5 transition-all duration-150"
              style={{
                background: bg,
                border,
                cursor: interactive ? (clickable ? 'pointer' : 'not-allowed') : 'default',
              }}
            >
              {(isSelected || isHovered || isFinal || isAdjacentToHovered) && (
                <span
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded-full leading-none"
                  style={{
                    background: 'rgba(5,7,15,.75)',
                    color: isFinal ? '#c084fc' : isSelected || isHovered ? 'var(--a)' : 'var(--text)',
                  }}
                >
                  {zone.name}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

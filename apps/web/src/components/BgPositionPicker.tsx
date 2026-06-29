'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Props {
  imageUrl: string;
  position: string;           // "50% 30%"
  onChange: (pos: string) => void;
}

/** Высота превью — имитирует как фон выглядит в профиле */
const PREVIEW_H = 180;

export function BgPositionPicker({ imageUrl, position, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startPct = useRef(0);

  // Парсим текущий Y из "50% 30%"
  const currentY = parseFloat(position.split(' ')[1] ?? '30');

  const applyY = useCallback((y: number) => {
    const clamped = Math.max(0, Math.min(100, y));
    onChange(`50% ${Math.round(clamped)}%`);
  }, [onChange]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startPct.current = currentY;
    e.preventDefault();
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    // Сколько пикселей перетащили → конвертируем в %
    const dy = e.clientY - startY.current;
    const containerH = containerRef.current.getBoundingClientRect().height;
    const dpct = (dy / containerH) * 100;
    applyY(startPct.current - dpct); // тащим вниз = показываем выше
  }, [applyY]);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // Touch поддержка
  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    startY.current = e.touches[0].clientY;
    startPct.current = currentY;
  };
  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const dy = e.touches[0].clientY - startY.current;
    const containerH = containerRef.current.getBoundingClientRect().height;
    applyY(startPct.current - (dy / containerH) * 100);
  }, [applyY]);
  const onTouchEnd = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove as any, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove as any);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onMouseMove, onMouseUp, onTouchMove, onTouchEnd]);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
        Предпросмотр — тяни чтобы выбрать зону
      </div>

      {/* Превью */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden select-none"
        style={{ height: PREVIEW_H, cursor: 'grab', border: '1px solid var(--border2)' }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <img
          src={imageUrl}
          alt="preview"
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: position,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
        {/* Затемнение как на реальном профиле */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(5,7,15,.05) 0%, rgba(5,7,15,.7) 70%, rgba(5,7,15,1) 100%)' }}
        />
        {/* Подсказка по центру */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium"
            style={{ background: 'rgba(0,0,0,.5)', color: '#fff', backdropFilter: 'blur(8px)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7-7 7 7"/>
            </svg>
            Тяни вверх / вниз
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7 7 7-7"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Слайдер для точного контроля */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>Верх</span>
        <input
          type="range"
          min={0}
          max={100}
          value={currentY}
          onChange={(e) => applyY(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: 'var(--a)' }}
        />
        <span className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>Низ</span>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface MapItem {
  id: string;
  name: string;
  imageUrl: string;
  isActive: boolean;
}

export default function AdminMapsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isOwner = user?.role === 'OWNER';
  const [editTarget, setEditTarget] = useState<MapItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const { data: maps, isLoading } = useQuery<MapItem[]>({
    queryKey: ['admin-maps'],
    queryFn: () => api.get('/maps'),
  });

  const openEdit = (map: MapItem) => {
    setEditTarget(map);
    setEditName(map.name);
    setEditActive(map.isActive);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setEditError(null);
    setEditSaving(true);
    try {
      await api.patch(`/maps/${editTarget.id}`, { name: editName, isActive: editActive });
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-maps'] });
    } catch (e) {
      setEditError(e instanceof ApiClientError ? e.message : 'Не удалось сохранить изменения');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить карту «${name}»? Это действие нельзя отменить.`)) return;
    try {
      await api.delete(`/maps/${id}`);
      qc.invalidateQueries({ queryKey: ['admin-maps'] });
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : 'Не удалось удалить карту');
    }
  };

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-4xl mx-auto" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
        <h1 className="font-display font-bold uppercase" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
          Карты
        </h1>
        <Link href="/admin/maps/create" className="btn-main">
          + Добавить карту
        </Link>
      </div>

      {isLoading && <p style={{ color: 'var(--muted)' }}>Загрузка...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {maps?.map((map) => (
          <div key={map.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="aspect-square w-full" style={{ background: 'var(--surface2)' }}>
              <img src={map.imageUrl} alt={map.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-4">
              <div className="font-display font-semibold uppercase mb-1" style={{ fontSize: '16px' }}>
                {map.name}
              </div>
              <span className="text-xs" style={{ color: map.isActive ? 'var(--green)' : 'var(--muted)' }}>
                {map.isActive ? 'Активна' : 'Скрыта'}
              </span>
              {isOwner && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => openEdit(map)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex-1"
                    style={{ color: 'var(--a)', background: 'rgba(79,127,255,0.06)', border: '1px solid rgba(79,127,255,0.18)' }}
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => handleDelete(map.id, map.name)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex-1"
                    style={{ color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && (!maps || maps.length === 0) && (
        <p style={{ color: 'var(--muted)' }}>
          Карты пока не загружены.{' '}
          <Link href="/admin/maps/create" style={{ color: 'var(--a)' }}>
            Добавить первую
          </Link>
        </p>
      )}

      {/* EDIT MODAL — только Owner */}
      {editTarget && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,.7)' }} onClick={() => setEditTarget(null)}>
          <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold uppercase text-sm tracking-wider mb-4" style={{ color: 'var(--muted)' }}>
              Редактировать карту
            </h2>
            {editError && (
              <div className="text-sm rounded-lg px-4 py-3 mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                {editError}
              </div>
            )}
            <label className="label-field">Название</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input-field mb-3" />
            <label className="flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--text)' }}>
              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
              Карта активна (доступна для выбора в новых матчах)
            </label>
            <div className="flex gap-2">
              <button onClick={() => setEditTarget(null)} className="btn-out flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                Отмена
              </button>
              <button onClick={handleSaveEdit} disabled={editSaving} className="btn-main flex-1" style={{ padding: '10px', fontSize: '13px' }}>
                {editSaving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

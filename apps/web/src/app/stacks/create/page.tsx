'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { ImageUploadField } from '@/components/ImageUploadField';
import { StackTag } from '@/components/StackTag';

export default function CreateStackPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [color, setColor] = useState('#4f7fff');
  const [desc, setDesc] = useState('');
  const [logo, setLogo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--muted)' }}>Войдите, чтобы создать стак.</p>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Укажите название'); return; }
    if (!tag.trim()) { setError('Укажите тег'); return; }
    setSubmitting(true);
    try {
      const stack = await api.post<{ id: string }>('/stacks', {
        name: name.trim(),
        tag: tag.trim().toUpperCase(),
        tagColor: color,
        description: desc.trim() || undefined,
        logoUrl: logo || undefined,
      });
      router.push(`/stacks/${stack.id}`);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Не удалось создать стак');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-20" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Link href="/stacks" className="text-sm" style={{ color: 'var(--muted)' }}>← Назад к топу</Link>
          <h1 className="font-display font-bold uppercase mt-3" style={{ fontSize: 'clamp(24px,4vw,36px)', letterSpacing: '-0.01em' }}>
            Создать стак
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Постоянная команда для участия в матчах вместе.</p>
        </div>

        <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
          {error && (
            <div className="text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{error}</div>
          )}

          <div>
            <label className="label-field">Название <span style={{ color: 'var(--a)' }}>*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="например: Night Wolves" className="input-field" maxLength={64} />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label-field">Тег (макс. 4 символа) <span style={{ color: 'var(--a)' }}>*</span></label>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4))}
                placeholder="WOLF"
                className="input-field font-mono uppercase"
                maxLength={4}
              />
            </div>
            <div>
              <label className="label-field">Цвет тега</label>
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-11 h-11 rounded-lg cursor-pointer" style={{ border: '1px solid var(--border2)' }} />
                <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{color}</span>
              </div>
            </div>
          </div>

          {tag && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              Предпросмотр: <StackTag tag={tag} color={color} /> {name || 'Название стака'}
            </div>
          )}

          <div>
            <label className="label-field">Описание (необязательно)</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Расскажите о стаке..." className="input-field" maxLength={500} />
          </div>

          <ImageUploadField label="Логотип (необязательно)" value={logo} onChange={setLogo} folder="media-thumbs" />

          <button type="submit" disabled={submitting} className="btn-main justify-center mt-2">
            {submitting ? 'Создаём...' : 'Создать стак'}
          </button>
        </form>
      </div>
    </div>
  );
}

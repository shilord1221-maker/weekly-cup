'use client';

import { useRef, useState, useEffect } from 'react';
import { api, ApiClientError, uploadFile } from '@/lib/api';

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: 'media-thumbs' | 'static-id-proofs' | 'news-covers' | 'map-images';
  required?: boolean;
  helperText?: string;
}

export function ImageUploadField({ label, value, onChange, folder, required, helperText }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageEnabled, setStorageEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .get<{ enabled: boolean }>('/upload/status', { auth: false })
      .then((r) => setStorageEnabled(r.enabled))
      .catch(() => setStorageEnabled(false));
  }, []);

  const handlePick = () => inputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadFile(file, folder);
      onChange(url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Не удалось загрузить файл');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (storageEnabled === false) {
    return (
      <div>
        <label className="label-field">
          {label} {required && <span style={{ color: 'var(--a)' }}>*</span>}
        </label>
        <input value={value} onChange={(e) => onChange(e.target.value)} className="input-field" placeholder="https://..." />
        {helperText && (
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            {helperText}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="label-field">
        {label} {required && <span style={{ color: 'var(--a)' }}>*</span>}
      </label>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelected} className="hidden" />

      {value ? (
        <div className="flex items-center gap-3 rounded-lg p-2" style={{ border: '1px solid var(--border2)', background: 'rgba(255,255,255,.02)' }}>
          <img src={value} alt="Превью" className="w-14 h-14 rounded-md object-cover flex-shrink-0" />
          <span className="text-xs flex-1 truncate" style={{ color: 'var(--muted)' }}>
            {value}
          </span>
          <button type="button" onClick={handlePick} disabled={uploading} className="btn-out flex-shrink-0" style={{ padding: '8px 14px', fontSize: '12px' }}>
            {uploading ? '...' : 'Заменить'}
          </button>
          <button type="button" onClick={() => onChange('')} className="flex-shrink-0 text-xs px-2" style={{ color: '#f87171' }}>
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading || storageEnabled === null}
          className="w-full rounded-lg py-6 flex flex-col items-center gap-2 transition-colors"
          style={{ border: '1px dashed var(--border2)', background: 'rgba(255,255,255,.02)', color: 'var(--muted)' }}
        >
          <span className="text-2xl">{uploading ? '⏳' : '📁'}</span>
          <span className="text-sm">{uploading ? 'Загружаем...' : 'Выбрать файл с компьютера'}</span>
          <span className="text-xs">JPEG, PNG, WEBP или GIF, до 8MB</span>
        </button>
      )}

      {error && <p className="error-text">{error}</p>}
      {helperText && !error && (
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
          {helperText}
        </p>
      )}
    </div>
  );
}

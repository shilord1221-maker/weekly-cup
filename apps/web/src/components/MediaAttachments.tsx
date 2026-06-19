'use client';

import { useState } from 'react';

interface LightboxProps {
  urls: string[];
  size?: number;
}

/** Определяет, видео это или изображение, по расширению/паттерну URL */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?.*)?$/i.test(url) || url.includes('/video/');
}

export function MediaGrid({ urls, size = 90 }: LightboxProps) {
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  if (!urls || urls.length === 0) return null;

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {urls.map((url, i) => (
          <button
            key={i}
            onClick={() => setOpenUrl(url)}
            className="rounded-lg overflow-hidden flex-shrink-0 transition-transform hover:scale-105"
            style={{ width: size, height: size, border: '1px solid var(--border2)', background: 'var(--surface2)' }}
          >
            {isVideoUrl(url) ? (
              <video src={url} className="w-full h-full object-cover" muted />
            ) : (
              <img src={url} alt={`Вложение ${i + 1}`} className="w-full h-full object-cover" />
            )}
          </button>
        ))}
      </div>

      {/* LIGHTBOX OVERLAY */}
      {openUrl && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setOpenUrl(null)}
        >
          <button
            className="absolute top-5 right-6 text-3xl"
            style={{ color: 'var(--text)' }}
            onClick={() => setOpenUrl(null)}
          >
            ✕
          </button>
          {isVideoUrl(openUrl) ? (
            <video src={openUrl} controls autoPlay className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={openUrl} alt="Увеличенное изображение" className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </>
  );
}

interface MediaUrlInputProps {
  urls: string[];
  onChange: (urls: string[]) => void;
}

/** Простой ввод ссылок на медиа — по одной ссылке на изображение/видео за раз, с превью */
export function MediaUrlInput({ urls, onChange }: MediaUrlInputProps) {
  const [input, setInput] = useState('');

  const addUrl = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (urls.includes(trimmed)) return;
    if (urls.length >= 10) return;
    onChange([...urls, trimmed]);
    setInput('');
  };

  const removeUrl = (url: string) => {
    onChange(urls.filter((u) => u !== url));
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder="Ссылка на изображение или видео (imgur, discord и т.д.)"
          className="input-field flex-1"
        />
        <button type="button" onClick={addUrl} className="btn-out" style={{ padding: '10px 18px', fontSize: '13px' }}>
          Добавить
        </button>
      </div>
      <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
        Загрузите файл на любой сервис (например, скопируйте ссылку из Discord) и вставьте ссылку здесь. До 10 вложений.
      </p>

      {urls.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-3">
          {urls.map((url, i) => (
            <div key={i} className="relative">
              <div className="w-16 h-16 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border2)', background: 'var(--surface2)' }}>
                {isVideoUrl(url) ? (
                  <video src={url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={url} alt={`Вложение ${i + 1}`} className="w-full h-full object-cover" />
                )}
              </div>
              <button
                type="button"
                onClick={() => removeUrl(url)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

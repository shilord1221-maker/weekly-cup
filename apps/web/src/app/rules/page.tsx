'use client';

import { useState } from 'react';

const TABS = [
  {
    id: 'general',
    label: 'Общие правила',
    content: [
      'Участие в кастомных матчах Weekly Cup доступно всем зарегистрированным игрокам с привязанным Static ID.',
      'Перед началом матча игрок обязан вступить в лобби и выбрать команду не позднее времени старта.',
      'Организатор имеет право переносить игроков между командами и изменять составы до начала матча.',
      'Неспортивное поведение, оскорбления в чате и читерство — основания для жалобы и последующей блокировки.',
    ],
  },
  {
    id: 'zones',
    label: 'Зоны и финальная зона',
    content: [
      'Зоны на карте выбираются организатором по графу соседства — каждая новая зона должна граничить хотя бы с одной из уже выбранных.',
      'Финальная зона объявляется во время матча и должна граничить с одной из ранее выбранных зон.',
      'После выбора финальной зоны у команд есть 2 минуты на заход. По истечении времени окно автоматически закрывается.',
      'Несвоевременный заход в финальную зону может быть основанием для технического поражения по решению организатора.',
    ],
  },
  {
    id: 'voice',
    label: 'Discord Voice',
    content: [
      'Каждая команда получает отдельный голосовой канал в Discord на время матча.',
      'Ссылка на канал доступна в карточке команды в лобби сразу после распределения по командам.',
      'Использование стороннего voice-чата вместо предоставленного канала не допускается во время официальных матчей.',
    ],
  },
  {
    id: 'complaints',
    label: 'Жалобы',
    content: [
      'Жалобу может подать любой зарегистрированный игрок через раздел «Жалобы».',
      'Игрок видит статус только своих жалоб; организаторы и администраторы — все жалобы.',
      'Статусы рассмотрения: Новая → На рассмотрении → Решена/Отклонена. Решение сопровождается комментарием администратора.',
    ],
  },
];

export default function RulesPage() {
  const [active, setActive] = useState(TABS[0].id);
  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <div className="min-h-screen px-6 md:px-10 pt-32 pb-20 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <h1 className="font-display font-bold uppercase mb-10" style={{ fontSize: 'clamp(28px,4vw,40px)', letterSpacing: '-0.01em' }}>
        Правила
      </h1>

      <div className="flex gap-2 mb-8 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: active === tab.id ? 'rgba(79,127,255,.1)' : 'transparent',
              border: `1px solid ${active === tab.id ? 'rgba(79,127,255,.3)' : 'var(--border)'}`,
              color: active === tab.id ? 'var(--a)' : 'var(--muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        <ul className="flex flex-col gap-4">
          {activeTab.content.map((line, i) => (
            <li key={i} className="text-sm leading-relaxed flex gap-3" style={{ color: 'var(--text)' }}>
              <span style={{ color: 'var(--a)' }}>—</span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

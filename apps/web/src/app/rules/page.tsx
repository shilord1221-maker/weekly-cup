'use client';

import { useState } from 'react';

interface ViolationRule {
  text: string;
  penalty: string;
}

const VIOLATIONS: ViolationRule[] = [
  {
    text: 'Если указано время захода (например, 21:13), нужно зайти ровно в эту минуту (00 секунд, допустима погрешность 1 минута). Не успели — ждёте следующую игру.',
    penalty: 'Отстранение на 2 игры',
  },
  {
    text: 'Нельзя давать RK (реанимировать команду противника) или просить, чтобы вас реснули.',
    penalty: 'Кик с сервера / отстранение на 5 игр',
  },
  {
    text: 'Нельзя играть в большем количестве, чем заявлено в режиме матча (например, если режим 2×2, а вас трое в команде).',
    penalty: 'Отстранение на 5 игр',
  },
  {
    text: 'Нельзя заранее заходить в игровую зону до объявленного времени.',
    penalty: 'Отстранение на 2 игры',
  },
  {
    text: 'Команда обязана постоянно двигаться по карте и не занимать одну локацию более двух минут.',
    penalty: 'Отстранение на 1 игру',
  },
  {
    text: 'Во время игры нельзя заходить в войс к другим командам/игрокам.',
    penalty: 'Кик с сервера / отстранение на 5 игр',
  },
  {
    text: 'Нельзя заезжать на машине в игровую зону.',
    penalty: 'Отстранение на 3 игры',
  },
  {
    text: 'Нельзя играть на крышах.',
    penalty: 'Отстранение на 3 игры / бан',
  },
  {
    text: 'Нельзя DM\'ить (наносить урон) перед началом матча или пробивать колёса.',
    penalty: 'Отстранение на 4 игры / бан',
  },
];

const DISCORD_LINKS = [
  {
    label: 'Время захода, карта и зоны',
    desc: 'В этот канал кидаются время захода, карта и зоны, которые мы играем.',
    url: 'https://discordapp.com/channels/1503166605855690793/1510340808761413774',
  },
  {
    label: 'Войс после смерти команды',
    desc: 'После смерти своей команды заходите в этот войс — чтобы вас не мували и не было споров, что вы «ещё играете».',
    url: 'https://discord.com/channels/1503166605855690793/1509959162031767613',
  },
  {
    label: 'Фото с победой',
    desc: 'Если выиграли прак — кидайте фото с датой в этот канал.',
    url: 'https://discordapp.com/channels/1503166605855690793/1503176511979651123',
  },
];

interface TabItem {
  id: string;
  label: string;
  content?: string[];
  violations?: ViolationRule[];
  links?: { label: string; desc: string; url: string }[];
}

const TABS: TabItem[] = [
  {
    id: 'general',
    label: 'Общие правила',
    content: [
      'Участие в кастомных матчах Weekly Pracs доступно всем зарегистрированным игрокам с привязанным Static ID.',
      'Перед началом матча игрок обязан вступить в лобби и выбрать команду не позднее времени старта.',
      'Организатор имеет право переносить игроков между командами и изменять составы до начала матча.',
      'Неспортивное поведение, оскорбления в чате и читерство — основания для жалобы и последующей блокировки.',
    ],
  },
  {
    id: 'violations',
    label: 'Нарушения и наказания',
    violations: VIOLATIONS,
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
    id: 'discord-links',
    label: 'Discord-каналы',
    links: DISCORD_LINKS,
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

      {/* Обычный текстовый список правил */}
      {activeTab.content && (
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
      )}

      {/* Нарушения с наказаниями — нумерованный список с акцентом на штраф */}
      {activeTab.violations && (
        <div className="flex flex-col gap-3">
          {activeTab.violations.map((v, i) => (
            <div key={i} className="card flex gap-4 items-start" style={{ padding: '20px 24px' }}>
              <div
                className="font-display font-bold flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ background: 'rgba(79,127,255,.1)', color: 'var(--a)' }}
              >
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--text)' }}>
                  {v.text}
                </p>
                <span
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 rounded-full"
                  style={{ color: '#f87171', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}
                >
                  ⚠ {v.penalty}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Discord-каналы — карточки со ссылками */}
      {activeTab.links && (
        <div className="flex flex-col gap-3">
          {activeTab.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card flex items-center justify-between gap-4 transition-all hover:translate-x-1"
              style={{ padding: '20px 24px', textDecoration: 'none' }}
            >
              <div>
                <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
                  {link.label}
                </div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {link.desc}
                </p>
              </div>
              <span
                className="font-mono text-[11px] px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ color: '#a5b4fc', background: 'rgba(88,101,242,.1)', border: '1px solid rgba(88,101,242,.25)' }}
              >
                Открыть →
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { ChatPanel } from '@/components/ChatPanel';

export default function ChatPage() {
  return (
    <div className="px-6 md:px-10 pt-32 pb-10 max-w-3xl mx-auto" style={{ background: 'var(--bg)' }}>
      <ChatPanel height="calc(100vh - 160px)" />
    </div>
  );
}

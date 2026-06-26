'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken, setOnTokenRefreshed } from '@/lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let sharedSocket: Socket | null = null;

function createSocket(): Socket {
  return io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket'],
    auth: { token: getAccessToken() },
  });
}

export function getSharedSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = createSocket();
    setOnTokenRefreshed(reconnectSocket);
  }
  return sharedSocket;
}

/**
 * Пересоздаём сокет с актуальным токеном после его ротации.
 * Вызывается из tryRefresh после успешного обновления access-токена.
 */
export function reconnectSocket(): void {
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  sharedSocket = createSocket();
}

export function useSocket(): Socket {
  const ref = useRef<Socket | null>(null);
  ref.current = getSharedSocket();
  useEffect(() => {}, []);
  return ref.current;
}

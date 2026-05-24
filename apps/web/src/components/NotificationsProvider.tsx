'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io, type Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const SOCKET_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export type ConnectionStatus = 'connecting' | 'live' | 'offline';

export interface LiveLeadItem {
  assignmentId: string;
  publicLeadId: string;
  leadType: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  createdAt: string;
  deliveryStatus: string;
}

export interface Notification {
  id: string;
  kind: 'lead' | 'payment' | 'order';
  title: string;
  description?: string;
  href?: string;
  createdAt: string;
}

interface NotificationsContextValue {
  status: ConnectionStatus;
  notifications: Notification[];
  unreadCount: number;
  /** Mark every notification as read. */
  markAllRead: () => void;
  /** Drop everything from the panel. */
  clearAll: () => void;
  /** Leads streamed in since the page loaded — fed by lead.delivered. */
  liveLeads: LiveLeadItem[];
  /** Seed the live-lead store on mount of the live page. */
  seedLiveLeads: (leads: LiveLeadItem[]) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/** Single shared Socket.IO connection + notification store for the app. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [liveLeads, setLiveLeads] = useState<LiveLeadItem[]>([]);
  const [lastReadAt, setLastReadAt] = useState<number>(() => Date.now());
  const socketRef = useRef<Socket | null>(null);

  // Generate a quick unique id without pulling in nanoid.
  const newId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const pushNotification = useCallback((n: Omit<Notification, 'id' | 'createdAt'>) => {
    setNotifications((prev) =>
      [{ ...n, id: newId(), createdAt: new Date().toISOString() }, ...prev].slice(0, 50),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect(): Promise<void> {
      let token: string;
      try {
        const res = await fetch('/api/auth/socket-token');
        if (!res.ok) throw new Error('no socket token');
        token = ((await res.json()) as { token: string }).token;
      } catch {
        if (!cancelled) setStatus('offline');
        return;
      }
      if (cancelled) return;

      const socket = io(SOCKET_ORIGIN, {
        auth: { token },
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      socket.on('connect', () => setStatus('live'));
      socket.on('disconnect', () => setStatus('offline'));
      socket.on('connect_error', () => setStatus('offline'));
      socket.on('unauthorized', () => setStatus('offline'));

      socket.on(
        'lead.delivered',
        (payload: LiveLeadItem, ack?: (response: unknown) => void) => {
          if (typeof ack === 'function') ack({ received: true });
          const item: LiveLeadItem = { ...payload, deliveryStatus: 'DELIVERED' };
          setLiveLeads((prev) =>
            prev.some((l) => l.assignmentId === item.assignmentId) ? prev : [item, ...prev],
          );
          pushNotification({
            kind: 'lead',
            title: `New ${payload.leadType.toLowerCase()} lead`,
            description: payload.fullName ?? payload.publicLeadId,
            href: '/client/leads',
          });
        },
      );

      socket.on('payment.paid', (payload: { publicOrderId?: string }) => {
        pushNotification({
          kind: 'payment',
          title: 'Payment received',
          description: payload.publicOrderId
            ? `Order ${payload.publicOrderId} is now paid.`
            : 'A payment landed for one of your orders.',
        });
      });

      socket.on(
        'order.status_changed',
        (payload: { publicOrderId?: string; status?: string }) => {
          pushNotification({
            kind: 'order',
            title: `Order ${payload.publicOrderId ?? ''}`.trim(),
            description: payload.status
              ? `Status changed to ${payload.status.toLowerCase().replace('_', ' ')}.`
              : 'Status changed.',
          });
        },
      );
    }

    void connect();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [pushNotification]);

  const seedLiveLeads = useCallback((leads: LiveLeadItem[]) => {
    setLiveLeads((prev) => {
      // Merge: prefer existing realtime entries so we don't clobber acks.
      const ids = new Set(prev.map((l) => l.assignmentId));
      return [...prev, ...leads.filter((l) => !ids.has(l.assignmentId))];
    });
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => new Date(n.createdAt).getTime() > lastReadAt).length,
    [notifications, lastReadAt],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      status,
      notifications,
      unreadCount,
      markAllRead: () => setLastReadAt(Date.now()),
      clearAll: () => {
        setNotifications([]);
        setLastReadAt(Date.now());
      },
      liveLeads,
      seedLiveLeads,
    }),
    [status, notifications, unreadCount, liveLeads, seedLiveLeads],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used inside <NotificationsProvider>');
  }
  return ctx;
}

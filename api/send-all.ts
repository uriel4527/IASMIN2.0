import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

type Sub = { endpoint: string } & Record<string, any>;
let memory: Map<string, Sub> = (globalThis as any).__subs || new Map<string, Sub>();
(globalThis as any).__subs = memory;

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string | undefined;
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const parseBody = (req: any) => new Promise<any>((resolve) => {
  if (req.body) return resolve(req.body);
  let data = '';
  req.on('data', (c: any) => (data += c));
  req.on('end', () => resolve(data ? JSON.parse(data) : {}));
});

const getSubs = async (): Promise<any[]> => {
  if (supabase) {
    // Preferir JSONB 'subscription' (não depende de colunas específicas)
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('is_active', true);
    if (error) {
      console.error('Supabase select error:', error);
    }
    const subs = (data || [])
      .map((row: any) => row.subscription)
      .filter((s: any) => s && s.endpoint && (s.keys?.p256dh || s.p256dh_key) && (s.keys?.auth || s.auth_key));
    // Deduplicar por endpoint
    const map = new Map<string, any>();
    for (const s of subs) {
      const endpoint = s.endpoint;
      map.set(endpoint, s);
    }
    return Array.from(map.values());
  }
  // fallback memória
  return Array.from(memory.values());
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const body = await parseBody(req);
  const title = body?.title || 'Notificação';
  const msg = body?.body || 'Mensagem';
  const url = body?.url || '/';

  const pub = process.env.VAPID_PUBLIC_KEY as string;
  const priv = process.env.VAPID_PRIVATE_KEY as string;
  const email = process.env.VAPID_EMAIL || 'admin@example.com';

  if (!pub || !priv) {
    res.status(500).json({ error: 'VAPID keys missing' });
    return;
  }

  webpush.setVapidDetails('mailto:' + email, pub, priv);

  const subs = await getSubs();
  let sent = 0;
  let failed = 0;
  const tag = `global-${Date.now()}`;
  const payload = JSON.stringify({ title, body: msg, data: { url }, tag, renotify: true });

  await Promise.all(
    subs.map((s) =>
      webpush
        .sendNotification(s, payload, { TTL: 300 })
        .then(() => {
          sent++;
        })
        .catch(() => {
          failed++;
        })
    )
  );

  res.status(200).json({ sent, failed, total: subs.length });
}

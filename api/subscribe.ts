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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const sub = (await parseBody(req)) as Sub;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh || (sub as any)?.p256dh_key;
  const auth = sub?.keys?.auth || (sub as any)?.auth_key;
  const user_id = (sub as any)?.userId || null;

  if (supabase) {
    const now = new Date().toISOString();
    // 1) Inserir JSONB 'subscription' (compatível com tabela sem coluna endpoint)
    const payloadJson: any = { subscription: sub, is_active: true, updated_at: now };
    if (user_id) payloadJson.user_id = user_id;
    const { error: insJson } = await supabase
      .from('push_subscriptions')
      .insert(payloadJson);
    if (insJson) {
      console.error('Supabase insert (JSONB) error:', insJson);
      // 2) Fallback: inserir colunas específicas se existirem
      const payloadCols: any = { endpoint, p256dh_key: p256dh, auth_key: auth, is_active: true, updated_at: now };
      if (user_id) payloadCols.user_id = user_id;
      const { error: insCols } = await supabase
        .from('push_subscriptions')
        .insert(payloadCols);
      if (insCols) {
        console.error('Supabase insert (columns) error:', insCols);
        if (endpoint) memory.set(endpoint, sub);
        res.status(200).json({ ok: true, stored: 'memory', reason: 'supabase_insert_error' });
        return;
      }
    }
    res.status(200).json({ ok: true, stored: 'supabase' });
    return;
  }
  if (endpoint) {
    memory.set(endpoint, sub);
  }
  res.status(200).json({ ok: true, stored: 'memory', reason: 'no_supabase_client' });
}

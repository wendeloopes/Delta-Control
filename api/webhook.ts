import { parseCommand } from '../lib/parseCommand';
import { enqueueMovement, QueuedMovement } from '../server/queue';

declare const process: { env: Record<string, string | undefined> };

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | string>;
};
type ApiResponse = { status(code: number): ApiResponse; json(value: unknown): void; send(value: string): void };
export const config = { api: { bodyParser: false } };

function header(request: ApiRequest, name: string): string {
  const entry = Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  return Array.isArray(entry) ? entry[0] ?? '' : entry ?? '';
}
function query(request: ApiRequest, name: string): string {
  const value = request.query?.[name];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}
function constantTimeEqual(left: string, right: string): boolean {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) mismatch |= (left.charCodeAt(i % Math.max(left.length, 1)) || 0) ^ (right.charCodeAt(i % Math.max(right.length, 1)) || 0);
  return mismatch === 0;
}
async function readRawBody(request: ApiRequest): Promise<Uint8Array> {
  if (!request[Symbol.asyncIterator]) throw new Error('Raw request stream unavailable.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of request as AsyncIterable<Uint8Array | string>) {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
    total += bytes.byteLength;
    if (total > 1_000_000) throw new Error('Webhook payload too large.');
    chunks.push(bytes);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}
async function verifyMetaSignature(rawBody: Uint8Array, signature: string, appSecret: string): Promise<boolean> {
  if (!/^sha256=[a-f0-9]{64}$/i.test(signature) || !appSecret) return false;
  const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, rawBody));
  const expected = 'sha256=' + Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(signature.toLowerCase(), expected);
}
function safeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}
function safeMessageId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const id = value.trim();
  return id.length <= 200 && /^[A-Za-z0-9._:@-]+$/.test(id) ? id : '';
}
function extractMetaMessages(payload: unknown): Array<{ id: string; text: string; phoneNumberId: string }> {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  if (root.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) return [];
  const messages: Array<{ id: string; text: string; phoneNumberId: string }> = [];
  for (const entryValue of root.entry) {
    if (!entryValue || typeof entryValue !== 'object') continue;
    const entry = entryValue as Record<string, unknown>;
    if (!Array.isArray(entry.changes)) continue;
    for (const changeValue of entry.changes) {
      if (!changeValue || typeof changeValue !== 'object') continue;
      const change = changeValue as Record<string, unknown>;
      const value = change.value && typeof change.value === 'object' ? change.value as Record<string, unknown> : {};
      const metadata = value.metadata && typeof value.metadata === 'object' ? value.metadata as Record<string, unknown> : {};
      const phoneNumberId = typeof metadata.phone_number_id === 'string' ? metadata.phone_number_id : '';
      if (!Array.isArray(value.messages)) continue;
      for (const messageValue of value.messages) {
        if (!messageValue || typeof messageValue !== 'object') continue;
        const message = messageValue as Record<string, unknown>;
        const type = message.type;
        const content = message[type as string];
        const body = content && typeof content === 'object' ? content as Record<string, unknown> : {};
        const text = type === 'text' ? safeText(body.body) : (type === 'image' || type === 'document') ? safeText(body.caption) : '';
        const id = safeMessageId(message.id);
        if (id && text) messages.push({ id, text, phoneNumberId });
      }
    }
  }
  return messages;
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method === 'GET') {
    const mode = query(request, 'hub.mode');
    const token = query(request, 'hub.verify_token');
    const challenge = query(request, 'hub.challenge');
    const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? '';
    if (mode === 'subscribe' && expected && constantTimeEqual(token, expected) && challenge) {
      response.status(200).send(challenge);
      return;
    }
    response.status(403).json({ error: 'verification_failed' });
    return;
  }
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  try {
    const rawBody = await readRawBody(request);
    const valid = await verifyMetaSignature(rawBody, header(request, 'x-hub-signature-256'), process.env.META_APP_SECRET ?? '');
    if (!valid) {
      response.status(401).json({ error: 'invalid_signature' });
      return;
    }
    const payload = JSON.parse(new TextDecoder().decode(rawBody)) as unknown;
    const messages = extractMetaMessages(payload);
    const expectedPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    let accepted = 0;
    let ignored = 0;
    for (const incoming of messages) {
      if (expectedPhoneNumberId && incoming.phoneNumberId !== expectedPhoneNumberId) { ignored += 1; continue; }
      const parsed = parseCommand(incoming.text);
      if (!parsed) { ignored += 1; continue; }
      const movement: QueuedMovement = {
        id: 'whatsapp-' + incoming.id,
        type: parsed.type === 'gasto' ? 'saida' : parsed.type === 'ganho' ? 'entrada' : 'investimento',
        amount: parsed.amount,
        description: parsed.description,
        category: parsed.category,
        createdAt: parsed.date.toISOString(),
        ...(parsed.installments ? { installment: parsed.installments + 'x' } : {}),
        paid: true,
        demo: false,
        source: 'whatsapp',
      };
      if (await enqueueMovement(movement, incoming.id)) accepted += 1;
      else ignored += 1;
    }
    response.status(200).json({ received: messages.length, accepted, ignored });
  } catch (error) {
    const detail = error instanceof Error ? error.name : 'UnknownError';
    console.error('[whatsapp:meta-webhook] processing_failed', detail);
    response.status(503).json({ error: 'webhook_processing_unavailable' });
  }
}

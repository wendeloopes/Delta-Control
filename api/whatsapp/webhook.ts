import { parseCommand } from '../../lib/parseCommand';
import { enqueueMovement, QueuedMovement } from '../../server/queue';

declare const process: { env: Record<string, string | undefined> };

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
} & AsyncIterable<Uint8Array | string>;

type ApiResponse = {
  status(code: number): ApiResponse;
  send(value: string): void;
  json(value: unknown): void;
};

export const config = { api: { bodyParser: false } };

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

async function readRawBody(request: ApiRequest): Promise<string> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
    size += bytes.length;
    if (size > 1_000_000) throw new Error('payload_too_large');
    chunks.push(bytes);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(body);
}

async function validSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!signature.startsWith('sha256=')) return false;
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const expected = 'sha256=' + Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return difference === 0;
}

async function sendText(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_GRAPH_API_VERSION;
  if (!token || !phoneNumberId || !version) throw new Error('whatsapp_send_not_configured');

  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  });
  if (!response.ok) throw new Error('whatsapp_send_failed');
}

function getIncomingMessages(payload: unknown): Array<{ id: string; from: string; text: string }> {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const messages: Array<{ id: string; from: string; text: string }> = [];
  for (const entryValue of entries) {
    const entry = entryValue && typeof entryValue === 'object' ? entryValue as Record<string, unknown> : {};
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const changeValue of changes) {
      const change = changeValue && typeof changeValue === 'object' ? changeValue as Record<string, unknown> : {};
      const value = change.value && typeof change.value === 'object' ? change.value as Record<string, unknown> : {};
      const incoming = Array.isArray(value.messages) ? value.messages : [];
      for (const messageValue of incoming) {
        const message = messageValue && typeof messageValue === 'object' ? messageValue as Record<string, unknown> : {};
        const textObject = message.text && typeof message.text === 'object' ? message.text as Record<string, unknown> : {};
        if (typeof message.id !== 'string' || typeof message.from !== 'string') continue;
        const body = typeof textObject.body === 'string' ? textObject.body : '';
        if (body.trim()) messages.push({ id: message.id, from: message.from, text: body });
      }
    }
  }
  return messages;
}

function money(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method === 'GET') {
    const query = request.query ?? {};
    const mode = first(query['hub.mode']);
    const token = first(query['hub.verify_token']);
    const challenge = first(query['hub.challenge']);
    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
      response.status(200).send(challenge);
      return;
    }
    response.status(403).send('forbidden');
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    response.status(503).json({ error: 'webhook_not_configured' });
    return;
  }

  try {
    const rawBody = await readRawBody(request);
    const signature = first(request.headers['x-hub-signature-256']);
    if (!(await validSignature(rawBody, signature, appSecret))) {
      response.status(401).json({ error: 'invalid_signature' });
      return;
    }

    const allowedNumber = (process.env.WHATSAPP_ALLOWED_NUMBER ?? '').replace(/\\D/g, '');
    if (!allowedNumber) {
      response.status(503).json({ error: 'allowed_number_not_configured' });
      return;
    }

    const payload = JSON.parse(rawBody) as unknown;
    const messages = getIncomingMessages(payload);
    for (const incoming of messages) {
      if (incoming.from !== allowedNumber) continue;

      const parsed = parseCommand(incoming.text);
      if (!parsed) {
        await sendText(incoming.from, 'Não consegui identificar esse lançamento. Exemplos:\\n• Gastei 35 reais no almoço\\n• Recebi 2500 de salário\\n• Investi 100 reais em renda fixa');
        continue;
      }

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

      const inserted = await enqueueMovement(movement, incoming.id);
      const kind = parsed.type === 'gasto' ? 'Despesa' : parsed.type === 'ganho' ? 'Entrada' : 'Investimento';
      const status = inserted ? 'recebido e enviado ao Delta Control' : 'já havia sido recebido anteriormente';
      await sendText(incoming.from, `✅ ${kind} ${status}.\\n\\n${parsed.description}: ${money(parsed.amount)}\\nCategoria: ${parsed.category}`);
    }

    response.status(200).json({ received: true });
  } catch {
    response.status(503).json({ error: 'webhook_processing_failed' });
  }
}

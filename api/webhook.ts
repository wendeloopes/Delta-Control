import { parseCommand } from '../lib/parseCommand';
import { enqueueMovement, isAuthorized, QueuedMovement } from '../server/queue';

declare const process: { env: Record<string, string | undefined> };

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type ApiResponse = {
  status(code: number): ApiResponse;
  json(value: unknown): void;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function extractMessage(body: unknown): { text: string; id: string; fromMe: boolean } {
  const root = record(body);
  const data = record(root.data);
  const key = record(data.key);
  const message = record(data.message);
  const extended = record(message.extendedTextMessage);
  const image = record(message.imageMessage);
  const text = [
    message.conversation,
    extended.text,
    root.text,
    root.message,
    image.caption,
  ].find(value => typeof value === 'string' && value.trim()) as string | undefined;
  const id = [key.id, data.messageId, root.messageId, root.id]
    .find(value => typeof value === 'string' && value.trim()) as string | undefined;
  return { text: text ?? '', id: id ?? '', fromMe: key.fromMe === true || data.fromMe === true };
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const token = process.env.DELTA_WEBHOOK_TOKEN || process.env.DELTA_API_TOKEN;
  if (!isAuthorized(request, token)) {
    response.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const incoming = extractMessage(request.body);
    if (incoming.fromMe || !incoming.text.trim()) {
      response.status(200).json({ accepted: false, reason: 'not_a_user_text_message' });
      return;
    }
    if (!incoming.id) {
      response.status(400).json({ error: 'missing_message_id' });
      return;
    }

    const parsed = parseCommand(incoming.text);
    if (!parsed) {
      response.status(200).json({ accepted: false, reason: 'command_not_recognized' });
      return;
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
    response.status(200).json({ accepted: inserted, duplicate: !inserted, movementId: movement.id });
  } catch {
    response.status(503).json({ error: 'queue_unavailable' });
  }
}

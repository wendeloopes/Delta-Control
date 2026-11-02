import { parseCommand } from '../lib/parseCommand';
import { enqueueMovement, isAuthorized, QueuedMovement } from '../server/queue';
declare const process: { env: Record<string, string | undefined> };
declare const console: { error(...args: unknown[]): void };
type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type ApiResponse = { status(code: number): ApiResponse; json(value: unknown): void };
function obj(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function sanitizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}
function sanitizeMessageId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const id = value.trim();
  return id.length <= 200 && /^[A-Za-z0-9._:@-]+$/.test(id) ? id : '';
}
function extractMessage(body: unknown): { text: string; id: string; fromMe: boolean } {
  const root = obj(body), data = obj(root.data), key = obj(data.key), message = obj(data.message), extended = obj(message.extendedTextMessage), image = obj(message.imageMessage);
  const text = [message.conversation, extended.text, root.text, root.message, image.caption].map(sanitizeText).find(Boolean) ?? '';
  const id = [key.id, data.messageId, root.messageId, root.id].map(sanitizeMessageId).find(Boolean) ?? '';
  return { text, id, fromMe: key.fromMe === true || data.fromMe === true };
}
export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if (request.method !== 'POST') { response.status(405).json({ error: 'method_not_allowed' }); return; }
  if (!isAuthorized(request, process.env.DELTA_API_SECRET)) { response.status(401).json({ error: 'unauthorized' }); return; }
  try {
    const incoming = extractMessage(request.body);
    if (incoming.fromMe || !incoming.text) { response.status(200).json({ accepted: false, reason: 'not_a_user_text_message' }); return; }
    if (!incoming.id) { response.status(400).json({ error: 'invalid_message_id' }); return; }
    const parsed = parseCommand(incoming.text);
    if (!parsed) { response.status(200).json({ accepted: false, reason: 'command_not_recognized' }); return; }
    const movement: QueuedMovement = { id: 'whatsapp-' + incoming.id, type: parsed.type === 'gasto' ? 'saida' : parsed.type === 'ganho' ? 'entrada' : 'investimento', amount: parsed.amount, description: parsed.description, category: parsed.category, createdAt: parsed.date.toISOString(), ...(parsed.installments ? { installment: parsed.installments + 'x' } : {}), paid: true, demo: false, source: 'whatsapp' };
    const inserted = await enqueueMovement(movement, incoming.id);
    response.status(200).json({ accepted: inserted, duplicate: !inserted, movementId: movement.id });
  } catch (error) {
    // Log only a bounded error class/message; never log request bodies or credentials.
    const detail = error instanceof Error ? error.name : 'UnknownError';
    console.error('[whatsapp:webhook] processing_failed', detail);
    response.status(503).json({ error: 'queue_unavailable' });
  }
}

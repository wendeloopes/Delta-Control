import type { Movement } from './storage';

export function parseQuickCommand(input: string): Omit<Movement, 'id' | 'createdAt'> | null {
  const text = input.trim();
  if (!text) return null;
  const normalized = text.toLocaleLowerCase('pt-BR');
  const amountMatch = normalized.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const isIncome = /\b(entrada|recebi|ganhei|venda|sal[aá]rio|dep[oó]sito)\b/.test(normalized);
  const isExpense = /\b(sa[ií]da|gastei|paguei|compra|despesa|conta|pix enviado)\b/.test(normalized);
  if (!isIncome && !isExpense) return null;
  const description = text
    .replace(/r\$\s*/ig, '')
    .replace(/\d+(?:[.,]\d{1,2})?/, '')
    .replace(/\b(entrada|sa[ií]da|recebi|ganhei|venda|sal[aá]rio|dep[oó]sito|gastei|paguei|compra|despesa|conta|pix enviado)\b/ig, '')
    .trim().replace(/^[-–—:]+|[-–—:]+$/g, '') || (isIncome ? 'Entrada rápida' : 'Saída rápida');
  return { type: isIncome ? 'entrada' : 'saida', amount, description };
}
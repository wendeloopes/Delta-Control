import { categoryForDescription } from './categories';

export type ParsedCommand = {
  type: 'gasto' | 'ganho' | 'investimento';
  amount: number;
  description: string;
  category: string;
  date: Date;
  installments?: number;
};

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() .replace(/[!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
const units: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};
const numberWords = new Set([...Object.keys(units), 'e', 'mil', 'milhao', 'milhoes', 'meio', 'reais', 'real', 'conto', 'contos']);

function integerWords(tokens: string[]): number | null {
  let total = 0;
  let group = 0;
  for (const token of tokens) {
    if (token === 'e') continue;
    if (token === 'mil' || token === 'milhao' || token === 'milhoes') {
      total += Math.max(group, 1) * (token === 'mil' ? 1000 : 1000000);
      group = 0;
      continue;
    }
    const value = units[token];
    if (value === undefined) return null;
    group += value;
  }
  return total + group;
}

function wordsToNumber(tokens: string[]): number | null {
  if (tokens.length === 1 && tokens[0] === 'meio') return 0.5;
  const currencyIndex = tokens.findIndex(token => ['reais', 'real', 'conto', 'contos'].includes(token));
  const wholeTokens = currencyIndex >= 0 ? tokens.slice(0, currencyIndex) : tokens;
  const centsTokens = currencyIndex >= 0 ? tokens.slice(currencyIndex + 1).filter(token => token !== 'e') : [];
  const whole = integerWords(wholeTokens);
  if (whole === null) return null;
  if (centsTokens.length) {
    const cents = integerWords(centsTokens);
    if (cents === null || cents > 99) return null;
    return whole + cents / 100;
  }
  return whole;
}

const numberPattern = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)(?:\s+(mil)\b)?(?:\s+(?:reais?\s+)?e\s+(\d{1,2})\b)?/i;
const typePatterns = {
  investimento: /\b(investi|apliquei|aportei|guardei|investimento)\b/,
  ganho: /\b(recebi|ganhei|entrou|salario|renda|vendi|caiu|entrada)\b/,
  gasto: /\b(gastei|paguei|comprei|pago|despesa|saiu|debitei|mercado|uber|compra|saida)\b/,
};

export function parseCommand(input: string, now: Date = new Date()): ParsedCommand | null {
  if (!input.trim()) return null;
  let text = normalize(input);
  const type = typePatterns.investimento.test(text) ? 'investimento' : typePatterns.ganho.test(text) ? 'ganho' : typePatterns.gasto.test(text) ? 'gasto' : null;
  if (!type) return null;

  const installmentMatch = text.match(/\bem\s+(\d+)\s*(?:x|vezes)\b|\bparcelad[oa]\s+em\s+(\d+)\b/);
  const installments = installmentMatch ? Number(installmentMatch[1] || installmentMatch[2]) : undefined;
  if (installmentMatch) text = text.replace(installmentMatch[0], ' ');

  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const dateMatch = text.match(/\b(hoje|ontem|anteontem|dia\s+\d{1,2})\b/);
  if (dateMatch) {
    if (dateMatch[1] === 'ontem') date.setDate(date.getDate() - 1);
    else if (dateMatch[1] === 'anteontem') date.setDate(date.getDate() - 2);
    else if (dateMatch[1].startsWith('dia ')) {
      const day = Number(dateMatch[1].replace('dia ', ''));
      const candidate = new Date(now.getFullYear(), now.getMonth(), day, 12);
      if (day > 0 && day <= new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() && candidate <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)) date.setTime(candidate.getTime());
    }
    text = text.replace(dateMatch[0], ' ');
  }

  let amount: number | null = null;
  const numeric = text.match(numberPattern);
  if (numeric) {
    const raw = numeric[1];
    amount = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw.includes('.') && /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw);
    if (numeric[2]) amount *= 1000;
    if (numeric[3]) amount += Number(numeric[3]) / 100;
    text = text.replace(numeric[0], ' ');
  } else {
    const tokens = text.split(' ');
    let start = -1;
    let end = -1;
    for (let i = 0; i < tokens.length; i++) {
      if (!numberWords.has(tokens[i])) continue;
      let j = i;
      while (j < tokens.length && numberWords.has(tokens[j])) j++;
      const candidate = wordsToNumber(tokens.slice(i, j));
      if (candidate !== null && candidate > 0) { start = i; end = j; amount = candidate; break; }
    }
    if (start >= 0) tokens.splice(start, end - start);
    text = tokens.join(' ');
  }

  if (amount === null || !Number.isFinite(amount) || amount <= 0 || (installments !== undefined && (installments < 2 || installments > 48))) return null;
  text = text
    .replace(/\b(r\$|reais?|contos?)\b/g, ' ')
    .replace(/\b(gastei|paguei|comprei|pago|despesa|saiu|debitei|recebi|ganhei|entrou|vendi|caiu|entrada|investi|apliquei|aportei|guardei|investimento|saida|compra)\b/g, ' ')
    .replace(/\b(no|na|em|de|do|da|dos|das|com|para|por|e|um|uma|uns|umas)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const description = text ? text.charAt(0).toUpperCase() + text.slice(1) : (type === 'investimento' ? 'Investimento' : type === 'ganho' ? 'Entrada' : 'Gasto');
  return { type, amount: Math.round(amount * 100) / 100, description, category: categoryForDescription(description), date, ...(installments ? { installments } : {}) };
}

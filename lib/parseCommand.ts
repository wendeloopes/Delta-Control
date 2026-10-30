import { categoryForDescription } from './categories';

export type ParsedCommand = {
  type: 'gasto' | 'ganho' | 'investimento';
  amount: number;
  description: string;
  category: string;
  date: Date;
  installments?: number;
};

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
const units: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};
const numberWords = new Set([...Object.keys(units), 'e', 'mil', 'milhao', 'milhoes', 'meio', 'reais', 'real', 'conto', 'contos']);

function wordsToNumber(tokens: string[]): number | null {
  const useful = tokens.filter(t => t !== 'reais' && t !== 'real' && t !== 'conto' && t !== 'contos');
  if (!useful.length) return null;
  let total = 0, group = 0, decimal = false, cents = 0;
  for (let i = 0; i < useful.length; i++) {
    const t = useful[i];
    if (t === 'e') continue;
    if (t === 'meio') { if (total === 0 && group === 0) return 0.5; cents = 50; decimal = true; continue; }
    if (t === 'mil' || t === 'milhao' || t === 'milhoes') { total += Math.max(group, 1) * (t === 'mil' ? 1000 : 1000000); group = 0; continue; }
    const n = units[t];
    if (n === undefined) return null;
    if (decimal) cents = cents * 10 + n;
    else group += n;
  }
  const value = total + group;
  return decimal ? value + cents / 100 : value;
}

const numberPattern = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)/i;
const typePatterns = {
  investimento: /\b(investi|apliquei|aport(ei|o)|guardei|investimento)\b/,
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

  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const dateMatch = text.match(/\b(hoje|ontem|anteontem|dia\s+\d{1,2})\b/);
  if (dateMatch) {
    if (dateMatch[1] === 'ontem') date.setDate(date.getDate() - 1);
    else if (dateMatch[1] === 'anteontem') date.setDate(date.getDate() - 2);
    else if (dateMatch[1].startsWith('dia ')) {
      const day = Number(dateMatch[1].replace('dia ', ''));
      const candidate = new Date(now.getFullYear(), now.getMonth(), day, 12);
      if (day > 0 && day <= new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() && candidate <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)) date = candidate;
    }
    text = text.replace(dateMatch[0], ' ');
  }

  let amount: number | null = null;
  const numeric = text.match(numberPattern);
  if (numeric) {
    const raw = numeric[1];
    amount = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw.includes('.') && /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw);
    text = text.replace(numeric[0], ' ');
  } else {
    const tokens = text.split(' ');
    let start = -1, end = -1;
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

  text = text.replace(/\b(r\$|reais?|contos?)\b/g, ' ').replace(/\b(gastei|paguei|comprei|pago|despesa|saiu|debitei|recebi|ganhei|entrou|salario|renda|vendi|caiu|entrada|investi|apliquei|aportei|guardei|investimento|saida|compra)\b/g, ' ').replace(/\b(no|na|em|de|do|da|dos|das|com|para|por|e)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const description = text ? text.charAt(0).toUpperCase() + text.slice(1) : (type === 'investimento' ? 'Investimento' : type === 'ganho' ? 'Entrada' : 'Gasto');
  return { type, amount: Math.round(amount * 100) / 100, description, category: categoryForDescription(description), date, ...(installments ? { installments } : {}) };
}

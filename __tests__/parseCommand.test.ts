import { parseCommand } from '../lib/parseCommand';

const cases: Array<{ input: string; type: 'gasto' | 'ganho' | 'investimento' | null; amount?: number; category?: string; description?: string; installments?: number }> = [
  { input: 'gastei 10 reais no mercado', type: 'gasto', amount: 10, category: 'Alimentação', description: 'Mercado' },
  { input: 'gastei 32 no uber', type: 'gasto', amount: 32, category: 'Transporte', description: 'Uber' },
  { input: 'recebi 1500 de salário', type: 'ganho', amount: 1500, description: 'Salario' },
  { input: 'paguei trinta e dois reais e cinquenta de almoço', type: 'gasto', amount: 32.5 },
  { input: 'investi 200 reais', type: 'investimento', amount: 200 },
  { input: 'comprei um tênis de 300 em 3 vezes', type: 'gasto', amount: 300, installments: 3 },
  { input: 'gastei 10,50 ontem na padaria', type: 'gasto', amount: 10.5 },
  { input: 'bla bla', type: null },
];

export function runParseCommandTests(): void {
  for (const item of cases) {
    const parsed = parseCommand(item.input, new Date(2026, 9, 30, 12));
    if (parsed?.type !== item.type) throw new Error('Tipo incorreto: ' + item.input);
    if (item.amount !== undefined && parsed?.amount !== item.amount) throw new Error('Valor incorreto: ' + item.input + ' => ' + parsed?.amount);
    if (item.category && parsed?.category !== item.category) throw new Error('Categoria incorreta: ' + item.input);
    if (item.description && parsed?.description !== item.description) throw new Error('Descrição incorreta: ' + item.input + ' => ' + parsed?.description);
    if (item.installments && parsed?.installments !== item.installments) throw new Error('Parcelas incorretas: ' + item.input);
  }
}

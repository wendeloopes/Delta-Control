export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Alimentação: ['mercado', 'almoco', 'jantar', 'lanche', 'ifood', 'restaurante', 'padaria', 'cafe', 'comida'],
  Transporte: ['uber', '99', 'onibus', 'gasolina', 'combustivel', 'estacionamento', 'taxi', 'metro'],
  Moradia: ['aluguel', 'condominio', 'energia', 'agua', 'luz', 'internet'],
  Saúde: ['farmacia', 'remedio', 'consulta', 'medico', 'dentista', 'exame'],
  Lazer: ['cinema', 'show', 'viagem', 'jogo', 'passeio'],
  Educação: ['curso', 'escola', 'faculdade', 'livro', 'mensalidade'],
  Assinaturas: ['netflix', 'spotify', 'assinatura', 'streaming'],
  Outros: [],
};

export function categoryForDescription(description: string): string {
  const normalized = description.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => normalized.includes(keyword))) return category;
  }
  return 'Outros';
}

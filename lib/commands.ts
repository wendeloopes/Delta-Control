import type {Movement} from './storage';
export function parseQuickCommand(input:string):Omit<Movement,'id'|'createdAt'>|null{
 const text=input.trim();if(!text)return null;const normalized=text.toLocaleLowerCase('pt-BR');
 const match=normalized.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/);if(!match)return null;
 const amount=Number(match[1].replace(',','.'));if(!Number.isFinite(amount)||amount<=0)return null;
 const investment=/\b(investimento|investi|apliquei|aplicação|reserva)\b/.test(normalized);
 const income=/\b(entrada|recebi|ganhei|venda|sal[aá]rio|dep[oó]sito)\b/.test(normalized);
 const expense=/\b(sa[ií]da|gastei|paguei|compra|despesa|conta|pix enviado)\b/.test(normalized);
 if(!investment&&!income&&!expense)return null;
 const description=text.replace(/r\$\s*/ig,'').replace(/\d+(?:[.,]\d{1,2})?/,'').replace(/\b(entrada|sa[ií]da|recebi|ganhei|venda|sal[aá]rio|dep[oó]sito|gastei|paguei|compra|despesa|conta|pix enviado|investimento|investi|apliquei|aplicaç[aã]o|reserva)\b/ig,'').trim().replace(/^[-–—:]+|[-–—:]+$/g,'')||(investment?'Investimento':income?'Entrada rápida':'Saída rápida');
 return{type:investment?'investimento':income?'entrada':'saida',amount,description,paid:true};
}

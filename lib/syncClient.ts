import { Movement, syncExternalMovements } from './storage';
declare const process: { env: Record<string, string | undefined> };
const configuredUrl=process.env.EXPO_PUBLIC_DELTA_API_URL?.trim()??'';
const configuredToken=process.env.EXPO_PUBLIC_DELTA_API_TOKEN?.trim()??'';
function pendingEndpoint():string|null {
  if(!configuredUrl)return null;
  const base=configuredUrl.replace(/\/+$/,'');
  return base.endsWith('/api')?base+'/pending':base+'/api/pending';
}
function isMovement(value:unknown):value is Movement {
  if(!value||typeof value!=='object')return false;
  const item=value as Partial<Movement>;
  return typeof item.id==='string'&&item.id.length>0&&['entrada','saida','investimento'].includes(String(item.type))&&typeof item.amount==='number'&&Number.isFinite(item.amount)&&item.amount>0&&typeof item.description==='string'&&!!item.description.trim()&&typeof item.createdAt==='string'&&Number.isFinite(Date.parse(item.createdAt));
}
let activeSync:Promise<number>|null=null;
export function syncPendingMovements():Promise<number> {
  if(activeSync)return activeSync;
  activeSync=performSync().finally(()=>{activeSync=null;});
  return activeSync;
}
async function performSync():Promise<number> {
  const endpoint=pendingEndpoint();
  if(!endpoint||!configuredToken)return 0;
  try {
    const headers={'x-api-key':configuredToken,Accept:'application/json'};
    const response=await fetch(endpoint,{method:'GET',headers});
    if(!response.ok)return 0;
    const payload=await response.json() as {movements?:unknown};
    const movements=Array.isArray(payload.movements)?payload.movements.filter(isMovement):[];
    if(!movements.length)return 0;
    await syncExternalMovements(movements);
    const ackUrl=endpoint+'?ack='+encodeURIComponent(movements.map(item=>item.id).join(','));
    const ack=await fetch(ackUrl,{method:'GET',headers});
    return ack.ok?movements.length:0;
  } catch { return 0; }
}

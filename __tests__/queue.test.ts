declare const process:{env:Record<string,string|undefined>};
import {acknowledgeMovements,enqueueMovement,hashDeviceToken,isAuthorizedDeviceToken,listPendingMovements,QueuedMovement} from '../server/queue';
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
export async function runQueueTests():Promise<void>{
 const oldFetch=globalThis.fetch,oldUrl=process.env.UPSTASH_REDIS_REST_URL,oldRedis=process.env.UPSTASH_REDIS_REST_TOKEN;
 process.env.UPSTASH_REDIS_REST_URL='https://redis.example.test';process.env.UPSTASH_REDIS_REST_TOKEN='redis-test-token';
 const token='device-token-for-queue-test-0123456789abcdef',digest=await hashDeviceToken(token),calls:string[][][]=[];let inserts=0;
 const movement:QueuedMovement={id:'whatsapp-msg-1',type:'saida',amount:12.5,description:'Almoço',category:'Alimentação',createdAt:'2026-11-02T12:00:00.000Z',paid:true,demo:false,source:'whatsapp'};
 globalThis.fetch=(async(_i:RequestInfo|URL,init?:RequestInit)=>{const commands=JSON.parse(String(init?.body??'[]')) as string[][];calls.push(commands);return {ok:true,json:async()=>commands.map(c=>{if(c[0]==='SISMEMBER')return {result:c[2]===digest?1:0};if(c[0]==='EVAL'){inserts++;return {result:inserts===1?1:0};}if(c[0]==='LRANGE')return {result:[JSON.stringify(movement)]};if(c[0]==='LREM')return {result:1};return {result:0};})} as Response;}) as typeof fetch;
 try{
  assert(digest.length===64&&digest===await hashDeviceToken(token),'SHA-256 digest is deterministic 64-char hex');
  assert(await isAuthorizedDeviceToken(token),'Redis-authorized device token is accepted');
  assert(!(await isAuthorizedDeviceToken('revoked-device-token-0123456789abcdef')),'Missing/revoked token is denied');
  assert(calls.some(batch=>batch[0]?.[0]==='SISMEMBER'&&batch[0]?.[1]==='delta:authorized_devices'),'Redis Set delta:authorized_devices is checked');
  assert(await enqueueMovement(movement,'msg-1'),'First event is queued');
  assert(!(await enqueueMovement(movement,'msg-1')),'Duplicate event is rejected');
  assert((await listPendingMovements()).length===1,'Pending queue remains readable');
  assert(await acknowledgeMovements([movement.id])===1,'ACK removes only confirmed item');
 }finally{globalThis.fetch=oldFetch;if(oldUrl===undefined)delete process.env.UPSTASH_REDIS_REST_URL;else process.env.UPSTASH_REDIS_REST_URL=oldUrl;if(oldRedis===undefined)delete process.env.UPSTASH_REDIS_REST_TOKEN;else process.env.UPSTASH_REDIS_REST_TOKEN=oldRedis;}
}

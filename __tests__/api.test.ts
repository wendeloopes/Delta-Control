import webhook from '../api/webhook';
import pending from '../api/pending';
import { hashDeviceToken } from '../server/queue';
declare const process: { env: Record<string,string|undefined> };
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
function recorder(){let code=200;let value:unknown;let sent='';const response={status(n:number){code=n;return response;},json(v:unknown){value=v;},send(v:string){sent=v;}};return {response,status:()=>code,value:()=>value,sent:()=>sent};}
function request(method:string, body:unknown, headers:Record<string,string>={}, query?:Record<string,string>){
 const bytes=new TextEncoder().encode(JSON.stringify(body));
 return {method,headers,query,async *[Symbol.asyncIterator](){yield bytes;}};
}
async function signature(body:unknown, secret:string):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify(body));
 const key=await globalThis.crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=new Uint8Array(await globalThis.crypto.subtle.sign('HMAC',key,bytes));
 return 'sha256='+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}
export async function runApiTests():Promise<void>{
 const keys=['META_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_PHONE_NUMBER_ID','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'];
 const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 const oldFetch=globalThis.fetch;
 const valid='device-token-for-api-test-0123456789abcdef',hash=await hashDeviceToken(valid);
 process.env.META_APP_SECRET='meta-app-secret-unit-test';
 process.env.WHATSAPP_VERIFY_TOKEN='verify-token-unit-test';
 process.env.WHATSAPP_PHONE_NUMBER_ID='123456789';
 process.env.KV_REST_API_URL='https://redis.example.test';
 process.env.KV_REST_API_TOKEN='redis-test-token';
 let inserts=0;
 globalThis.fetch=(async(_input:RequestInfo|URL,init?:RequestInit)=>{
  const commands=JSON.parse(String(init?.body??'[]')) as string[][];
  return {ok:true,json:async()=>commands.map(command=>{
   if(command[0]==='SISMEMBER')return {result:command[2]===hash?1:0};
   if(command[0]==='EVAL'){const key=command[3]??'';if(processed.has(key))return {result:0};processed.add(key);return {result:1};}
   if(command[0]==='LRANGE')return {result:[]};
   if(command[0]==='LREM')return {result:1};
   return {result:0};
  })} as Response;
 }) as typeof fetch;
 try{
  const missing=recorder();await pending({method:'GET',headers:{}},missing.response);assert(missing.status()===401,'Missing device token returns 401');
  const invalid=recorder();await pending({method:'GET',headers:{Authorization:'Bearer device-token-invalid-0123456789abcdef'}},invalid.response);assert(invalid.status()===401,'Invalid or revoked token returns 401');
  const authorized=recorder();await pending({method:'GET',headers:{Authorization:'Bearer '+valid}},authorized.response);assert(authorized.status()===200,'Authorized device token is accepted');
  const verify=recorder();await webhook({method:'GET',headers:{},query:{'hub.mode':'subscribe','hub.verify_token':'verify-token-unit-test','hub.challenge':'challenge-123'}},verify.response);assert(verify.status()===200&&verify.sent()==='challenge-123','Meta GET verification returns the challenge');
  const denied=recorder();await webhook({method:'GET',headers:{},query:{'hub.mode':'subscribe','hub.verify_token':'wrong','hub.challenge':'challenge-123'}},denied.response);assert(denied.status()===403,'Wrong Meta verification token is rejected');
  const body={object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:'123456789'},messages:[{from:'5511999999999',id:'wamid.HBgABC+/=',timestamp:'1793640000',type:'text',text:{body:'gastei 20 no mercado'}}]}}]}]};
  const invalidSignature=recorder();await webhook(request('POST',body,{'x-hub-signature-256':'sha256='+ '0'.repeat(64)}) as never,invalidSignature.response);assert(invalidSignature.status()===401,'Invalid Meta signature is rejected');
  const validSignature=await signature(body,'meta-app-secret-unit-test');
  const accepted=recorder();await webhook(request('POST',body,{'x-hub-signature-256':validSignature}) as never,accepted.response);assert(accepted.status()===200,'Valid Meta Cloud API webhook is accepted');
  const result=accepted.value() as {received:number;accepted:number;ignored:number};assert(result.received===1&&result.accepted===1,'Meta text message is parsed and queued');
  const duplicate=recorder();await webhook(request('POST',body,{'x-hub-signature-256':validSignature}) as never,duplicate.response);const duplicateResult=duplicate.value() as {accepted:number;ignored:number};assert(duplicateResult.accepted===0&&duplicateResult.ignored===1,'Duplicate Meta message is not queued twice');
  const echoBody={object:'whatsapp_business_account',entry:[{changes:[{field:'smb_message_echoes',value:{metadata:{phone_number_id:'123456789'},message_echoes:[{from:'123456789',to:'123456789',id:'wamid.SELF-CHAT-123=',timestamp:'1793640000',type:'text',text:{body:'gastei 15 café'}}]}}]}]};
  const echoSignature=await signature(echoBody,'meta-app-secret-unit-test');
  const selfChat=recorder();await webhook(request('POST',echoBody,{'x-hub-signature-256':echoSignature}) as never,selfChat.response);
  assert(selfChat.status()===200,'Business App coexistence echo is accepted');
  const echoResult=selfChat.value() as {received:number;accepted:number;ignored:number};
  assert(echoResult.received===1&&echoResult.accepted===1,'Message sent from the same Business App number can be queued through smb_message_echoes');

 }finally{
  globalThis.fetch=oldFetch;
  for(const key of keys){const value=old[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
}

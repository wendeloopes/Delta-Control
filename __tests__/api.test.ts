import webhook from '../api/webhook';
import pending from '../api/pending';
import { hashDeviceToken } from '../server/queue';
declare const process: { env: Record<string,string|undefined> };
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
function recorder(){let code=200;const response={status(n:number){code=n;return response;},json(_v:unknown){}};return {response,status:()=>code};}
export async function runApiTests():Promise<void>{
 const oldSecret=process.env.DELTA_API_SECRET,oldUrl=process.env.UPSTASH_REDIS_REST_URL,oldRedis=process.env.UPSTASH_REDIS_REST_TOKEN,oldFetch=globalThis.fetch;
 const valid='device-token-for-api-test-0123456789abcdef',hash=await hashDeviceToken(valid);
 process.env.DELTA_API_SECRET='unit-test-secret';process.env.UPSTASH_REDIS_REST_URL='https://redis.example.test';process.env.UPSTASH_REDIS_REST_TOKEN='redis-test-token';
 globalThis.fetch=(async(_i:RequestInfo|URL,init?:RequestInit)=>{const commands=JSON.parse(String(init?.body??'[]')) as string[][];return {ok:true,json:async()=>commands.map(c=>c[0]==='SISMEMBER'?{result:c[2]===hash?1:0}:c[0]==='LRANGE'?{result:[]}:{result:1})} as Response;}) as typeof fetch;
 try{
  const missing=recorder();await pending({method:'GET',headers:{}},missing.response);assert(missing.status()===401,'Missing device token returns 401');
  const legacy=recorder();await pending({method:'GET',headers:{'x-device-id':'public-id'}},legacy.response);assert(legacy.status()===401,'Public ID cannot authenticate');
  const invalid=recorder();await pending({method:'GET',headers:{Authorization:'Bearer device-token-invalid-0123456789abcdef'}},invalid.response);assert(invalid.status()===401,'Invalid or revoked token returns 401');
  const accepted=recorder();await pending({method:'GET',headers:{Authorization:'Bearer '+valid}},accepted.response);assert(accepted.status()===200,'Authorized SHA-256 member is accepted');
  const webhookMissing=recorder();await webhook({method:'POST',headers:{},body:{}},webhookMissing.response);assert(webhookMissing.status()===401,'Webhook requires its own server secret');
  const webhookGood=recorder();await webhook({method:'POST',headers:{Authorization:'Bearer unit-test-secret'},body:{data:{key:{id:'test-message',fromMe:false},message:{conversation:'gastei 20 no mercado'}}}},webhookGood.response);assert(webhookGood.status()===200,'Webhook auth remains separate');
 }finally{globalThis.fetch=oldFetch;if(oldSecret===undefined)delete process.env.DELTA_API_SECRET;else process.env.DELTA_API_SECRET=oldSecret;if(oldUrl===undefined)delete process.env.UPSTASH_REDIS_REST_URL;else process.env.UPSTASH_REDIS_REST_URL=oldUrl;if(oldRedis===undefined)delete process.env.UPSTASH_REDIS_REST_TOKEN;else process.env.UPSTASH_REDIS_REST_TOKEN=oldRedis;}
}

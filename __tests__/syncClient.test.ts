declare const process:{env:Record<string,string|undefined>};
import {__setSecureStoreAdapterForTests,__setStorageAdapterForTests,getOrCreateDeviceId,getOrCreateDeviceToken,loadAppData,syncExternalMovements} from '../lib/storage';
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
export async function runSyncClientTests():Promise<void>{
 const memory=new Map<string,string>(),secure=new Map<string,string>();let randomCalls=0;
 __setStorageAdapterForTests({getItem:async k=>memory.get(k)??null,setItem:async(k,v)=>{memory.set(k,v);}});
 __setSecureStoreAdapterForTests({getItemAsync:async k=>secure.get(k)??null,setItemAsync:async(k,v)=>{secure.set(k,v);}},async n=>{randomCalls++;return new Uint8Array(n).fill(0xab);});
 try{
  const initial=await loadAppData(),token=await getOrCreateDeviceToken();
  assert(token===await getOrCreateDeviceToken()&&/^[a-f0-9]{64}$/.test(token),'256-bit token persists in SecureStore');
  assert(randomCalls===1,'Secure random generator runs only once');
  assert(await getOrCreateDeviceId()===token.slice(0,8).toUpperCase(),'Only short public ID is displayed');
  assert(!Array.from(memory.keys()).some(k=>k.includes('device-token')),'Secret token is not in AsyncStorage');
  await syncExternalMovements([{id:'external-1',type:'entrada',amount:125.5,description:' Serviço ',category:'Renda',createdAt:'2026-11-02T10:00:00.000Z',paid:true}]);
  assert((await loadAppData()).movements.some(m=>m.id==='external-1'),'Financial records remain locally persisted');
  assert(memory.has('@delta-control:data:v1'),'Original financial data key is unchanged');
  const oldUrl=process.env.EXPO_PUBLIC_DELTA_API_URL;process.env.EXPO_PUBLIC_DELTA_API_URL='https://delta.example.test';
  const oldFetch=globalThis.fetch,headers:HeadersInit[]=[];let calls=0;
  globalThis.fetch=(async(_i:RequestInfo|URL,init?:RequestInit)=>{calls++;headers.push(init?.headers??{});if(calls===1)return {ok:true,json:async()=>({movements:[{id:'external-2',type:'investimento',amount:50,description:'Reserva',createdAt:'2026-11-02T11:00:00.000Z'}]})} as Response;return {ok:true,json:async()=>({acknowledged:1})} as Response;}) as typeof fetch;
  try{
   const {syncPendingMovements}=await import('../lib/syncClient');
   assert(await syncPendingMovements()===1,'Remote sync confirms saved item');
   assert(calls===2,'Client requests queue and sends ACK');
   assert((headers[0] as Record<string,string>).Authorization==='Bearer '+token,'GET uses Bearer device token');
   assert((headers[1] as Record<string,string>).Authorization==='Bearer '+token,'ACK reuses Bearer token');
   assert(!('x-device-id' in (headers[0] as Record<string,string>)),'Public ID is not an auth credential');
   assert((await loadAppData()).movements.some(m=>m.id==='external-2'),'Remote movement is saved before ACK');
  }finally{globalThis.fetch=oldFetch;if(oldUrl===undefined)delete process.env.EXPO_PUBLIC_DELTA_API_URL;else process.env.EXPO_PUBLIC_DELTA_API_URL=oldUrl;}
  assert(initial.movements.length>0,'Existing initial data remains available');
 }finally{__setSecureStoreAdapterForTests(null);__setStorageAdapterForTests(null);}
}

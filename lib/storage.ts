import AsyncStorage from '@react-native-async-storage/async-storage';
export type Movement={id:string;type:'entrada'|'saida'|'investimento';amount:number;description:string;createdAt:string;paid?:boolean;installment?:string};
export type AppData={openingBalance:number;movements:Movement[]};
const STORAGE_KEY='@delta-control:data:v1';
const initialData:AppData={openingBalance:1250,movements:[
{id:'demo-1',type:'entrada',amount:2500,description:'Salário',createdAt:new Date(Date.now()-86400000*3).toISOString(),paid:true},
{id:'demo-2',type:'saida',amount:85.9,description:'Mercado',createdAt:new Date(Date.now()-86400000*2).toISOString(),paid:true},
{id:'demo-3',type:'saida',amount:42,description:'Transporte',createdAt:new Date(Date.now()-86400000).toISOString(),paid:false},
{id:'demo-4',type:'investimento',amount:200,description:'Reserva financeira',createdAt:new Date().toISOString(),paid:true}]};
export async function loadAppData():Promise<AppData>{const raw=await AsyncStorage.getItem(STORAGE_KEY);if(!raw){await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(initialData));return initialData;}try{const parsed=JSON.parse(raw) as AppData;if(!Array.isArray(parsed.movements)||typeof parsed.openingBalance!=='number')throw new Error('Formato inválido');return parsed;}catch{await AsyncStorage.removeItem(STORAGE_KEY);await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(initialData));return initialData;}}
export async function saveAppData(data:AppData):Promise<void>{await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
export async function resetAppData():Promise<void>{await AsyncStorage.removeItem(STORAGE_KEY);}

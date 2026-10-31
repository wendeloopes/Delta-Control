import { acknowledgeMovements, isAuthorized, listPendingMovements } from '../server/queue';
declare const process: { env: Record<string, string | undefined> };
type ApiRequest = { method?: string; headers: Record<string, string | string[] | undefined>; query?: Record<string, string | string[] | undefined> };
type ApiResponse = { status(code: number): ApiResponse; json(value: unknown): void };
export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  if(request.method!=='GET'){response.status(405).json({error:'method_not_allowed'});return;}
  if(!isAuthorized(request,process.env.DELTA_SYNC_TOKEN||process.env.DELTA_API_TOKEN)){response.status(401).json({error:'unauthorized'});return;}
  try {
    const raw=request.query?.ack, value=Array.isArray(raw)?raw[0]:raw;
    const ids=typeof value==='string'?value.split(',').map(v=>v.trim()).filter(Boolean).slice(0,100):[];
    const acknowledged=await acknowledgeMovements(ids);
    const movements=await listPendingMovements();
    response.status(200).json({movements,acknowledged});
  } catch { response.status(503).json({error:'queue_unavailable'}); }
}

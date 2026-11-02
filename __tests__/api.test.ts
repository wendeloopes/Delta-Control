import webhook from '../api/webhook';
import pending from '../api/pending';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function responseRecorder() {
  let statusCode = 200;
  let payload: unknown;
  const response = {
    status(code: number) { statusCode = code; return response; },
    json(value: unknown) { payload = value; },
  };
  return { response, status: () => statusCode, payload: () => payload };
}
export async function runApiTests(): Promise<void> {
  const previousSecret = process.env.DELTA_API_SECRET;
  process.env.DELTA_API_SECRET = 'unit-test-secret';
  try {
    const webhookResponse = responseRecorder();
    await webhook({ method: 'POST', headers: {}, body: { data: { message: { conversation: 'gastei 20 no mercado' }, key: { id: 'abc' } } } }, webhookResponse.response);
    assert(webhookResponse.status() === 401, 'Webhook deve rejeitar requisição sem Bearer Token');

    const pendingResponse = responseRecorder();
    await pending({ method: 'GET', headers: {} }, pendingResponse.response);
    assert(pendingResponse.status() === 401, 'Pending deve rejeitar requisição sem Bearer Token');

    const legacyResponse = responseRecorder();
    await pending({ method: 'GET', headers: { 'x-api-key': 'unit-test-secret' } }, legacyResponse.response);
    assert(legacyResponse.status() === 401, 'Pending não deve aceitar x-api-key legado');
  } finally {
    if (previousSecret === undefined) delete process.env.DELTA_API_SECRET; else process.env.DELTA_API_SECRET = previousSecret;
  }
}

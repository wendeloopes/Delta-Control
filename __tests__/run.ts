import { runQueueTests } from './queue.test';
import { runApiTests } from './api.test';
import { runSyncClientTests } from './syncClient.test';

async function main(): Promise<void> {
  await runQueueTests();
  await runApiTests();
  await runSyncClientTests();
  console.log('PASS: parser, Redis queue/deduplication, API authentication and local/remote sync tests');
}
void main().catch(error => {
  console.error('FAIL: Delta Control test suite', error);
  throw error;
});

# Delta Control — Serverless webhook
Deploy the repository root to Vercel. The functions are `POST /api/webhook` and `GET /api/pending`. The latter accepts `?ack=id1,id2` only after the app has persisted those records locally.

## Vercel environment variables
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL.
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token.
- `DELTA_WEBHOOK_TOKEN`: secret used by Evolution API.
- `DELTA_SYNC_TOKEN`: token used by the mobile sync endpoint.
- Optional fallback: `DELTA_API_TOKEN` for either endpoint.

Create an Upstash Redis database. Queue contents are stored in Redis, never in serverless memory. WhatsApp message IDs are deduplicated for seven days.

## Expo build environment
- `EXPO_PUBLIC_DELTA_API_URL`: Vercel origin, e.g. `https://your-project.vercel.app` (no `/api` suffix required).
- `EXPO_PUBLIC_DELTA_API_TOKEN`: same value as `DELTA_SYNC_TOKEN`.

**Security:** Expo public variables are embedded in the APK and can be extracted. This shared token is only a basic gate for a controlled prototype, not per-user authentication. Do not put Upstash credentials or the webhook secret in the app. Add user/device authentication before multi-user production use.

## Delivery
Webhook text is interpreted by the app's existing `lib/parseCommand.ts`. The app fetches pending records, persists them through `syncExternalMovements`, then acknowledges IDs. Offline/network/storage failures leave the server queue unacknowledged for retry.

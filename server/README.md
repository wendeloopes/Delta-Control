# Delta Control — Serverless webhook

This folder contains the Redis-backed queue helpers used by the Vercel functions in `api/`.

## Deploy

Deploy the repository to Vercel with the project root set to the repository root. Vercel automatically exposes:

- `POST /api/webhook` — receives Evolution API message events.
- `GET /api/pending` — returns pending movements; `?ack=id1,id2` acknowledges IDs previously persisted by the app.

## Required server environment variables

Configure these in Vercel Project Settings → Environment Variables:

- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST URL.
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token.
- `DELTA_WEBHOOK_TOKEN` — long random secret used by Evolution API for webhook requests.
- `DELTA_SYNC_TOKEN` — token checked by the mobile sync endpoint.

If a specific token is omitted, the functions fall back to `DELTA_API_TOKEN`. Prefer separate webhook and sync tokens.

Create an Upstash Redis database and keep its credentials only in Vercel. The queue is stored in Redis, not serverless process memory. WhatsApp message IDs are deduplicated for seven days.

## Mobile build environment

Set these Expo public variables in the build environment before creating the APK:

- `EXPO_PUBLIC_DELTA_API_URL` — Vercel deployment origin, for example `https://your-project.vercel.app` (do not append `/api`).
- `EXPO_PUBLIC_DELTA_API_TOKEN` — must match `DELTA_SYNC_TOKEN`.

**Security note:** Expo public variables are bundled into the Android application and can be extracted. This shared token is suitable only as a basic integration gate for a controlled prototype; it is not equivalent to per-user authentication. Before exposing financial data to multiple users, add user/device authentication and authorization. Never put the Upstash token or webhook secret in the app.

## Delivery behavior

The webhook parses messages with the app's existing `lib/parseCommand.ts` and queues recognized commands. The app fetches the queue, writes valid movements to AsyncStorage, and only then sends an acknowledgement request. If the app is offline or the local write fails, the queue is not acknowledged and the items remain available for retry.

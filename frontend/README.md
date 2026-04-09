# Venta UI (Next.js + shadcn + RTK Query)

This frontend implements the exact layered flow:

1. **UI components** call **RTK Query hooks**
2. RTK Query calls **Next.js API routes** (`/api/proxy/...`)
3. Next.js API routes call the **Node.js backend API**
4. Payload is encrypted/decrypted on every hop

---

## Tech Stack

- Next.js App Router
- Redux Toolkit + RTK Query
- shadcn-style UI components (button/card/input/table primitives)
- Encrypted API envelopes using AES-GCM

---

## Required Environment Variables

Create `frontend/.env.local`:

```bash
BACKEND_API_URL="http://localhost:4000"
CLIENT_ENCRYPTION_SECRET="frontend-client-hop-secret"
BACKEND_ENCRYPTION_SECRET="replace-with-backend-encryption-secret"
NEXT_PUBLIC_CLIENT_ENCRYPTION_SECRET="frontend-client-hop-secret"
```

Set matching backend secret in `venta-api/.env`:

```bash
ENCRYPTION_SECRET="replace-with-backend-encryption-secret"
```

Important:
- `NEXT_PUBLIC_CLIENT_ENCRYPTION_SECRET` and `CLIENT_ENCRYPTION_SECRET` should match.
- `BACKEND_ENCRYPTION_SECRET` should match backend `ENCRYPTION_SECRET`.

---

## Run Locally

### 1) Start backend
From repo root:

```bash
npm run dev
```

### 2) Start frontend
From `frontend`:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Implemented API Coverage

The UI is wired to these backend groups through RTK Query + Next API proxy:

- `POST /auth/login`
- `POST /auth/2fa/verify-login`
- `GET /auth/me`
- `GET/POST /brands`
- `GET/POST /contacts`
- `GET/POST /logs`
- `GET /analytics/logs/revenue-trend`
- `GET /analytics/logs/conversion-rate`
- `GET /analytics/logs/leaderboard`

---

## Encryption Flow

### Browser -> Next API
- RTK Query baseQuery encrypts request body into `{ payload: "<base64>" }`
- Sends `x-encrypted: 1`
- Next route decrypts with `CLIENT_ENCRYPTION_SECRET`

### Next API -> Node API
- Next re-encrypts plain payload using `BACKEND_ENCRYPTION_SECRET`
- Sends to Node with `x-encrypted: 1`
- Node middleware decrypts with backend `ENCRYPTION_SECRET`

### Node API -> Next API -> Browser
- Node encrypts JSON responses when `x-encrypted: 1` is present
- Next decrypts backend payload, re-encrypts for browser
- RTK Query decrypts and returns plain JSON to UI components

---

## Main Files

- `src/store/services/api.ts`: RTK Query endpoints + client encryption baseQuery
- `src/app/api/proxy/[...path]/route.ts`: Next API encrypted proxy layer
- `src/app/page.tsx`: dashboard + auth screens
- `src/components/ui/*`: shadcn-style UI primitives
- `src/lib/encryption.ts`: browser crypto
- `src/lib/server-encryption.ts`: Next server crypto

---

## Notes

- This is an end-to-end flow scaffold aligned to your current backend.
- For production, use HTTPS plus strong rotated secrets from secure secret management.

# Deploy Job Easy Backend on Cloudflare Containers

This repository is now prepared for Cloudflare Containers. The backend runs in a Docker container, and a Cloudflare Worker routes incoming requests to that container.

## Files added

- `Dockerfile` - builds the FastAPI backend image and starts Uvicorn on port `8080`.
- `.dockerignore` - keeps frontend files, secrets, caches, and local files out of the backend image.
- `wrangler.toml` - Cloudflare Worker + Container + Durable Object configuration.
- `src/index.ts` - Worker entrypoint that forwards traffic to the backend container and passes runtime environment variables/secrets into it.
- `package.json` - Wrangler and Cloudflare Containers package/scripts.

## Required runtime variables

Set these in Cloudflare before deploying:

### Required secrets

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
```

`DATABASE_URL` must be an externally reachable PostgreSQL URL, for example:

```text
postgresql+asyncpg://USER:PASSWORD@HOST:PORT/DBNAME
```

### Strongly recommended secrets

```bash
npx wrangler secret put APP_ENCRYPTION_KEY
npx wrangler secret put SMTP_PASSWORD
```

Generate values locally:

```bash
# JWT_SECRET
openssl rand -hex 32

# APP_ENCRYPTION_KEY - Fernet key format
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### SMTP / email variables

You can set these as Cloudflare Worker variables or secrets. Use secrets for sensitive values.

```bash
npx wrangler secret put SMTP_HOST
npx wrangler secret put SMTP_PORT
npx wrangler secret put SMTP_USERNAME
npx wrangler secret put SMTP_PASSWORD
npx wrangler secret put SMTP_FROM_EMAIL
npx wrangler secret put SMTP_FROM_NAME
npx wrangler secret put SMTP_USE_TLS
npx wrangler secret put SMTP_USE_SSL
```

Typical Resend SMTP values:

```text
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=<your-resend-api-key>
SMTP_FROM_EMAIL=<verified sender email>
SMTP_FROM_NAME=Job Easy
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

### CORS / frontend variables

After the frontend is deployed, allow it to call this backend:

```bash
npx wrangler secret put BACKEND_CORS_ORIGINS
```

Value example:

```text
https://your-frontend.pages.dev,http://localhost:5173
```

Also set your frontend production build variable:

```text
VITE_API_URL=https://job-easy.<your-workers-subdomain>.workers.dev
```

## Local deployment flow

Cloudflare Containers are deployed with Wrangler. You need Docker running locally.

```bash
npm install
npx wrangler login
npx wrangler deploy
```

Check status:

```bash
npx wrangler containers list
npx wrangler tail
```

Health check:

```bash
curl https://job-easy.<your-workers-subdomain>.workers.dev/api/health
```

Expected response:

```json
{"status":"ok"}
```

## Notes

- Do not put secrets directly in `wrangler.toml`.
- Cloudflare Containers use port `8080` in this setup.
- The backend requires PostgreSQL. Cloudflare does not create this database automatically.
- This app currently stores uploaded CV PDFs in PostgreSQL (`cv_bytes`). Make sure your database plan can handle that storage.
- If the container fails immediately, check `npx wrangler tail`; missing `DATABASE_URL` or `JWT_SECRET` is the most common cause.

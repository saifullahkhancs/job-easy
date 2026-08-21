# Job Easy - Email Automation System

A multi-tenant job-application email system with a FastAPI backend and React frontend. Users can create email templates (subject, body, CV PDF) and send application emails via SMTP. The system includes role-based access control, approval workflows, and an admin dashboard.

## Features

- **Multi-tenant workflow**: Visitor, Customer, and Admin roles
- **Email templates**: Create, view, and manage email templates with CV attachments
- **Role-based access**: Visitors browse default templates, customers manage personal templates
- **Approval workflow**: Visitors request email automation access, admins approve/reject
- **Admin dashboard**: Internal/dev-only admin panel for managing users, requests, and templates
- **Template limits**: Each customer can create up to 2 personal templates
- **Security**: Encrypted app passwords, masked email display, role-based API access

## Project Structure

```
job_easy/
├── main.py                      # FastAPI backend entry point
├── requirements.txt             # Python dependencies
├── alembic.ini                  # Database migration config
├── database.py                  # Database connection
├── api/                         # API routes
│   ├── v1/
│   │   ├── auth.py             # Authentication endpoints
│   │   ├── users.py            # User endpoints
│   │   ├── templates_v2.py     # Template endpoints (v2)
│   │   ├── user_email_info.py  # User email info endpoints
│   │   ├── approval.py         # Approval workflow endpoints
│   │   └── admin.py            # Admin endpoints
│   └── dependencies.py         # Auth dependencies
├── models/                      # Database models
│   ├── user.py                 # User model
│   ├── user_templates.py       # Template model
│   ├── user_email_info.py      # User email info model
│   ├── email_automation_requests.py # Approval request model
│   └── roles.py                # Role enums
├── schemas/                     # Pydantic schemas
│   ├── auth.py                 # Auth schemas
│   ├── user.py                 # User schemas
│   ├── user_templates.py       # Template schemas
│   └── email_automation_requests.py # Approval schemas
├── core/                        # Core utilities
│   ├── config.py               # Configuration
│   ├── security.py            # Security utilities
│   └── encryption.py          # Encryption utilities
├── frontend/                    # React (Vite) app
│   ├── src/
│   │   ├── api/               # API client
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── admin/             # Admin pages (no.auth)
│   │   └── App.jsx            # Main routing
│   └── package.json
└── .env                         # Local secrets (not committed)
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL running locally

## Backend Setup

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

Create a `.env` file in the project root (you can start from `.env.example`):

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost/job_easy
JWT_SECRET=your-strong-secret-key

# AI Job Description Matcher — pick a FREE provider (no credit card needed)
AI_PROVIDER=auto                  # auto | gemini | groq | openrouter
GEMINI_API_KEY=                   # free key: https://aistudio.google.com/app/apikey
GROQ_API_KEY=                     # free key: https://console.groq.com/keys
OPENROUTER_API_KEY=               # free key: https://openrouter.ai/keys (use a ":free" model)

# Email via SMTP (SMTP_PASSWORD doubles as the Resend API key)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=re_xxxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM_EMAIL=your-verified-domain@example.com
SMTP_FROM_NAME=Job Easy
SMTP_USE_TLS=true

CORS_ORIGINS=http://localhost:5173
```

### Free AI API keys (no credit card required)

The AI job-description matcher works with **either** of two providers that offer
a genuinely free tier — you only need one free key:

| Provider | Where to get the key | Free tier (approx.) | Config |
| --- | --- | --- | --- |
| **Google Gemini** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) — sign in with Google, click "Create API key" | ~1,500 requests/day on Flash models, 15 RPM | `GEMINI_API_KEY` |
| **Groq** (Llama/Qwen) | [console.groq.com/keys](https://console.groq.com/keys) — sign up with email/GitHub/Google, click "Create API Key" | ~1,000 requests/day, 30 RPM, 6–8k tokens/minute | `GROQ_API_KEY` |
| **OpenRouter** (any model) | [openrouter.ai/keys](https://openrouter.ai/keys) — sign up, create a key; use a `:free` model | ~50 requests/day on free models (no card needed) | `OPENROUTER_API_KEY` |

1. Copy the key from the provider console.
2. Paste it into your `.env` next to `GEMINI_API_KEY=`, `GROQ_API_KEY=` or
   `OPENROUTER_API_KEY=`.
3. Leave `AI_PROVIDER=auto` (it uses whichever key is set; set `gemini`,
   `groq` or `openrouter` explicitly to force one).
4. Restart the backend.

OpenRouter note: its free models carry a `:free` suffix and rotate regularly
(e.g. `meta-llama/llama-3.3-70b-instruct:free`, `openai/gpt-oss-20b:free`).
Pick a current one from [openrouter.ai/models](https://openrouter.ai/models) and
set `OPENROUTER_MODEL`.

Two Groq-specific notes, since its free tier is token-tight:

- **Groq retires models often** (e.g. `llama-3.3-70b-versatile` was shut down
  in August 2026). The default is `qwen/qwen3.6-27b`; if you get a
  "decommissioned" error, pick a current model from
  [console.groq.com/docs/models](https://console.groq.com/docs/models) and set
  `GROQ_MODEL`.
- **Free tier caps tokens per minute (6,000–8,000 TPM)**, and the reservation
  for the reply counts against it. The app already keeps requests small
  (template text trimmed to 800 chars, reply capped at 1,024 tokens, job
  description capped at `AI_MATCH_MAX_CHARS`=4000) so one submission stays
  well under the cap. Don't raise `AI_MATCH_MAX_CHARS` much beyond that, or
  Groq will answer with 413 "request too large".

Free-tier keys are shared-rate-limited, which is why each user gets a daily cap
(`AI_MATCH_DAILY_LIMIT`, default 20). If the provider is rate-limited the API
answers with a clean `ai_unavailable` error instead of retrying in a loop.

Run database migrations:

```bash
alembic upgrade head
```

Start the API:

```bash
python main.py
```

API docs: http://127.0.0.1:8000/docs

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

Optional `.env` in `frontend/`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

## User Roles

- **Visitor**: Can browse default templates, request email automation access
- **Customer**: Can create up to 2 personal templates, send emails
- **Admin**: Can manage users, approve requests, manage default templates

## Key API Endpoints

### Authentication
- POST `/api/v1/auth/register` - User registration
- POST `/api/v1/auth/login` - User login
- GET `/api/v1/auth/me` - Get current user profile

### Templates (v2)
- GET `/api/v1/templates` - List templates (role-based)
- GET `/api/v1/templates/{id}` - Get template details
- POST `/api/v1/templates` - Create template (template_role, title, context, cv_pdf)
- PUT `/api/v1/templates/{id}` - Update template
- PATCH `/api/v1/templates/{id}/cv` - Update CV only
- DELETE `/api/v1/templates/{id}` - Delete template

### Admin (No Authentication - Internal/Dev-Only)
- GET `/api/v1/admin/users` - List users
- PATCH `/api/v1/admin/users/{email}` - Update user role/status
- GET `/api/v1/admin/approval-requests` - List approval requests
- PATCH `/api/v1/admin/approval-requests/{request_id}` - Approve/reject request
- GET `/api/v1/admin/default-templates` - List default templates
- POST `/api/v1/admin/default-templates` - Create default template

## Important Notes

- **Template Role**: Templates use `template_role` as a unique identifier per user (or globally for default templates)
- **Template Limit**: Each customer can create maximum 2 personal templates
- **Admin Dashboard**: The admin panel at `/admin` is intentionally open without authentication for internal/dev-only use. **Do not expose this publicly.**
- **Security**: App passwords are encrypted at rest and never exposed in API responses
- **Email Masking**: Admin views show masked sender emails only

## Frontend Routes

### Client Routes
- `/login` - User login
- `/signup` - User registration
- `/app` - Main dashboard (authenticated)
- `/app/templates` - Template management
- `/app/templates/new` - Create template (customer only)
- `/app/templates/:id/edit` - Edit template (customer only)
- `/app/send` - Send email (customer only)
- `/app/request-access` - Request email automation (visitor only)

### Admin Routes (No Auth - Internal/Dev-Only)
- `/admin` - Admin dashboard
- `/admin/dashboard` - Dashboard with statistics
- `/admin/requests` - Approval request management
- `/admin/users` - User management
- `/admin/default-templates` - Default template management

## Security Warning

The admin dashboard at `/admin` is intentionally accessible without authentication for internal development and testing purposes. **This is not safe for public exposure.** In a production environment, you must implement proper authentication and authorization for the admin panel.

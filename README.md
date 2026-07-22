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

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost/job_easy
JWT_SECRET=your-secret-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_SENDER_NAME=Your Name
CORS_ORIGINS=http://localhost:5173
```

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
- PATCH `/api/v1/admin/users/{user_id}` - Update user role/status
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

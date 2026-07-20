# Email Automation

A local job-application email system with a FastAPI backend and React frontend. Store email templates (subject, body, CV PDF) per job type in PostgreSQL and send application emails via SMTP.

## Features

- Upload new job templates (Python Developer, Full Stack Developer)
- View stored templates and preview CV PDFs
- Send emails with CV attachments
- Partially update templates (subject, body, or CV only) via PATCH

## Project Structure

```
Email_Automation/
├── main.py              # FastAPI backend
├── requirements.txt     # Python dependencies
├── frontend/            # React (Vite) app
└── .env                 # Local secrets (not committed)
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
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_SENDER_NAME=Your Name
DATABASE_URL=""
CORS_ORIGINS=""
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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/job-types` | Available job type options |
| GET | `/api/templates` | List all templates (metadata) |
| GET | `/api/templates/{type}` | Get full template details |
| GET | `/api/templates/{type}/cv` | Download/preview CV PDF |
| POST | `/api/templates` | Create a new template |
| PATCH | `/api/templates/{type}` | Update title, context, and/or CV |
| POST | `/api/send` | Send email to recipient |

### PATCH example

Update only the CV:

```bash
curl -X PATCH "http://127.0.0.1:8000/api/templates/Python%20Developer" \
  -F "cv_pdf=@updated_cv.pdf"
```

Update subject and body:

```bash
curl -X PATCH "http://127.0.0.1:8000/api/templates/Python%20Developer" \
  -F "title=New Subject" \
  -F "context=Updated email body"
```

## Frontend Pages

1. **Upload** — create a new template
2. **View Templates** — inspect subject, body, and CV preview
3. **Send Email** — send to a recipient
4. **Update Template** — patch individual fields

## Notes

- Gmail requires an [App Password](https://support.google.com/accounts/answer/185833) if 2FA is enabled.
- POST `/api/templates` returns `409` if the job type already exists; use PATCH to update.
- The backend still sends HTML email bodies for email-client compatibility; the React UI replaces the old inline HTML admin page.

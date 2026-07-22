from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File, Form
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn

from core.config import settings
from database import init_db
from api.v1 import templates, email
from api.v1 import auth, users
from api.v1 import user_email_info, approval, admin
from api.v1 import templates_v2


# Rate limiting
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Email Automation API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(user_email_info.router)
app.include_router(approval.router)
app.include_router(admin.router)
app.include_router(templates_v2.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.get("/api/job-types")
async def list_job_types():
    return await templates.list_job_types()


@app.get("/api/templates")
async def list_templates():
    return await templates.list_templates()


@app.get("/api/templates/{job_type}")
async def get_template(job_type: str):
    return await templates.get_template(job_type)


@app.get("/api/templates/{job_type}/cv")
async def download_cv(job_type: str):
    return await templates.download_cv(job_type)


@app.post("/api/templates")
async def create_template(
    type: templates.JobType = Form(...),
    title: str = Form(...),
    context: str = Form(...),
    cv_pdf: UploadFile = File(...),
):
    return await templates.create_template(type, title, context, cv_pdf)


@app.patch("/api/templates/{job_type}")
async def patch_template(
    job_type: str,
    title: Optional[str] = Form(None),
    context: Optional[str] = Form(None),
    cv_pdf: Optional[UploadFile] = File(None),
):
    return await templates.patch_template(job_type, title, context, cv_pdf)


@app.post("/api/send")
async def send_email(payload: email.SendEmailRequest):
    return await email.send_email(payload)


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

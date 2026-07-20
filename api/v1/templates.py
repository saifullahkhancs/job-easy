from enum import Enum
from typing import Optional

from fastapi import UploadFile, File, Form, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import async_session
from models.job_template import JobTemplate


class JobType(str, Enum):
    python_dev = "Python Developer"
    fullstack_dev = "Full Stack Developer"


class SendEmailRequest(BaseModel):
    recipient_email: EmailStr
    type: str


def template_to_dict(job: JobTemplate, include_context: bool = True) -> dict:
    data = {
        "type": job.type,
        "title": job.title,
        "filename": job.filename,
        "file_size_bytes": len(job.cv_bytes),
    }
    if include_context:
        data["context"] = job.context
    return data


async def get_template_by_type(session: AsyncSession, job_type: str) -> Optional[JobTemplate]:
    result = await session.execute(select(JobTemplate).where(JobTemplate.type == job_type))
    return result.scalars().first()


async def list_job_types():
    return {"job_types": [job_type.value for job_type in JobType]}


async def list_templates():
    async with async_session() as session:
        result = await session.execute(select(JobTemplate))
        jobs = result.scalars().all()
    return {"templates": [template_to_dict(job, include_context=False) for job in jobs]}


async def get_template(job_type: str):
    async with async_session() as session:
        job = await get_template_by_type(session, job_type)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job type '{job_type}' not found.",
        )

    return template_to_dict(job)


async def download_cv(job_type: str):
    async with async_session() as session:
        job = await get_template_by_type(session, job_type)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job type '{job_type}' not found.",
        )

    return Response(
        content=job.cv_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{job.filename}"'},
    )


async def create_template(
    type: JobType = Form(...),
    title: str = Form(...),
    context: str = Form(...),
    cv_pdf: UploadFile = File(...),
):
    if cv_pdf.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF",
        )

    cv_bytes = await cv_pdf.read()

    async with async_session() as session:
        existing = await get_template_by_type(session, type.value)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Job type '{type.value}' already exists. Use PATCH to update it.",
            )

        job = JobTemplate(
            type=type.value,
            title=title,
            context=context,
            cv_bytes=cv_bytes,
            filename=cv_pdf.filename or "cv.pdf",
        )
        session.add(job)
        await session.commit()

    return {
        "message": "Template created successfully",
        "template": template_to_dict(job),
    }


async def patch_template(
    job_type: str,
    title: Optional[str] = Form(None),
    context: Optional[str] = Form(None),
    cv_pdf: Optional[UploadFile] = File(None),
):
    if title is None and context is None and cv_pdf is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update: title, context, or cv_pdf.",
        )

    async with async_session() as session:
        job = await get_template_by_type(session, job_type)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job type '{job_type}' not found.",
            )

        updated_fields = []

        if title is not None:
            job.title = title
            updated_fields.append("title")

        if context is not None:
            job.context = context
            updated_fields.append("context")

        if cv_pdf is not None:
            if cv_pdf.content_type != "application/pdf":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File must be a PDF",
                )
            job.cv_bytes = await cv_pdf.read()
            job.filename = cv_pdf.filename or job.filename
            updated_fields.append("cv_pdf")

        await session.commit()

    return {
        "message": "Template updated successfully",
        "updated_fields": updated_fields,
        "template": template_to_dict(job),
    }

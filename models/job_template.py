from sqlalchemy import Column, Integer, String, LargeBinary
from sqlalchemy.orm import declarative_base

from models.user import Base


class JobTemplate(Base):
    __tablename__ = "job_templates"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    context = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    cv_bytes = Column(LargeBinary, nullable=False)

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.config import settings
from models.user import Base, User, PasswordResetToken
from models.job_template import JobTemplate
from models.user_templates import UserTemplate
from models.user_email_info import UserEmailInfo
from models.email_automation_requests import EmailAutomationRequest

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)

# Create a configured "Session" class.
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Initializes the database and creates tables if they don't exist."""
    async with engine.begin() as conn:
        # This will create all tables defined in models that inherit from Base
        await conn.run_sync(Base.metadata.create_all)

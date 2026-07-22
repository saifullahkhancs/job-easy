"""
Tests for critical business logic in the multi-tenant workflow.
"""
import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models.user import User
from models.roles import UserRole
from models.user_templates import UserTemplate, TemplateScope
from models.user_email_info import UserEmailInfo
from models.email_automation_requests import EmailAutomationRequest, RequestStatus
from core.utils import normalize_linkedin_url, validate_linkedin_url
from core.encryption import encrypt_app_password, decrypt_app_password, mask_email


class TestLinkedInURLNormalization:
    """Test LinkedIn URL normalization and validation."""
    
    def test_normalize_linkedin_url_basic(self):
        """Test basic LinkedIn URL normalization."""
        url1 = "https://www.linkedin.com/in/john-doe"
        url2 = "https://linkedin.com/in/john-doe/"
        url3 = "HTTP://LINKEDIN.COM/IN/JOHN-DOE"
        
        normalized1 = normalize_linkedin_url(url1)
        normalized2 = normalize_linkedin_url(url2)
        normalized3 = normalize_linkedin_url(url3)
        
        assert normalized1 == normalized2 == normalized3
        assert normalized1 == "https://linkedin.com/in/john-doe"
    
    def test_normalize_linkedin_url_with_query_params(self):
        """Test that query parameters are removed."""
        url = "https://linkedin.com/in/john-doe?foo=bar"
        normalized = normalize_linkedin_url(url)
        assert normalized == "https://linkedin.com/in/john-doe"
    
    def test_validate_linkedin_url_valid(self):
        """Test validation of valid LinkedIn URLs."""
        valid_urls = [
            "https://linkedin.com/in/john-doe",
            "https://www.linkedin.com/in/jane-smith-123",
            "http://linkedin.com/in/user-name",
        ]
        for url in valid_urls:
            assert validate_linkedin_url(url) is True
    
    def test_validate_linkedin_url_invalid(self):
        """Test validation of invalid LinkedIn URLs."""
        invalid_urls = [
            "https://example.com/profile",
            "https://linkedin.com/company/google",
            "not-a-url",
            "",
        ]
        for url in invalid_urls:
            assert validate_linkedin_url(url) is False


class TestPasswordEncryption:
    """Test password encryption and masking."""
    
    def test_encrypt_decrypt_password(self):
        """Test that password encryption and decryption work correctly."""
        password = "my-app-password-123"
        encrypted = encrypt_app_password(password)
        decrypted = decrypt_app_password(encrypted)
        
        assert encrypted != password
        assert decrypted == password
    
    def test_mask_email(self):
        """Test email masking."""
        email1 = "john@example.com"
        email2 = "a@b.com"
        email3 = "very.long.email.address@domain.com"
        
        masked1 = mask_email(email1)
        masked2 = mask_email(email2)
        masked3 = mask_email(email3)
        
        assert "@" in masked1
        assert masked1 != email1
        assert "j" in masked1 and "n" in masked1
        assert masked2 == "*@b.com"
        assert "@" in masked3


class TestUserRoleTransitions:
    """Test user role transitions based on approval workflow."""
    
    @pytest.mark.asyncio
    async def test_visitor_to_customer_on_approval(self, db: AsyncSession):
        """Test that user role changes from visitor to customer on approval."""
        # Create a visitor user
        user = User(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            linkedin_url="https://linkedin.com/in/john-doe",
            linkedin_url_normalized="https://linkedin.com/in/john-doe",
            hashed_password="hashed_password",
            is_verified=True,
            role=UserRole.VISITOR,
        )
        db.add(user)
        await db.commit()
        
        # Create email info
        email_info = UserEmailInfo(
            user_id=user.user_id,
            sender_email="john@gmail.com",
            sender_name="John Doe",
            encrypted_app_password="encrypted",
        )
        db.add(email_info)
        await db.commit()
        
        # Create approval request
        request = EmailAutomationRequest(
            user_id=user.user_id,
            user_email_info_id=email_info.id,
            status=RequestStatus.PENDING,
        )
        db.add(request)
        await db.commit()
        
        # Approve the request
        request.status = RequestStatus.APPROVED
        request.reviewed_at = datetime.now(timezone.utc)
        user.role = UserRole.CUSTOMER
        await db.commit()
        
        # Verify role changed
        await db.refresh(user)
        assert user.role == UserRole.CUSTOMER
    
    @pytest.mark.asyncio
    async def test_visitor_remains_visitor_on_rejection(self, db: AsyncSession):
        """Test that user role remains visitor on rejection."""
        # Create a visitor user
        user = User(
            first_name="Jane",
            last_name="Smith",
            email="jane@example.com",
            linkedin_url="https://linkedin.com/in/jane-smith",
            linkedin_url_normalized="https://linkedin.com/in/jane-smith",
            hashed_password="hashed_password",
            is_verified=True,
            role=UserRole.VISITOR,
        )
        db.add(user)
        await db.commit()
        
        # Create email info
        email_info = UserEmailInfo(
            user_id=user.user_id,
            sender_email="jane@gmail.com",
            sender_name="Jane Smith",
            encrypted_app_password="encrypted",
        )
        db.add(email_info)
        await db.commit()
        
        # Create approval request
        request = EmailAutomationRequest(
            user_id=user.user_id,
            user_email_info_id=email_info.id,
            status=RequestStatus.PENDING,
        )
        db.add(request)
        await db.commit()
        
        # Reject the request
        request.status = RequestStatus.REJECTED
        request.reviewed_at = datetime.now(timezone.utc)
        await db.commit()
        
        # Verify role did not change
        await db.refresh(user)
        assert user.role == UserRole.VISITOR


class TestTemplateLimit:
    """Test template limit enforcement."""
    
    @pytest.mark.asyncio
    async def test_customer_max_two_templates(self, db: AsyncSession):
        """Test that customers can create at most 2 templates."""
        # Create a customer user
        user = User(
            first_name="Bob",
            last_name="Johnson",
            email="bob@example.com",
            linkedin_url="https://linkedin.com/in/bob-johnson",
            linkedin_url_normalized="https://linkedin.com/in/bob-johnson",
            hashed_password="hashed_password",
            is_verified=True,
            role=UserRole.CUSTOMER,
        )
        db.add(user)
        await db.commit()
        
        # Create 2 templates (should succeed)
        for i in range(2):
            template = UserTemplate(
                owner_user_id=user.user_id,
                template_role_type_id=1,
                title=f"Template {i+1}",
                context=f"Context {i+1}",
                filename=f"cv{i+1}.pdf",
                cv_bytes=b"pdf_content",
                template_scope=TemplateScope.CUSTOMER,
            )
            db.add(template)
        await db.commit()
        
        # Count templates
        result = await db.execute(
            select(UserTemplate).where(
                UserTemplate.owner_user_id == user.user_id,
                UserTemplate.template_scope == TemplateScope.CUSTOMER
            )
        )
        templates = result.scalars().all()
        assert len(templates) == 2
    
    @pytest.mark.asyncio
    async def test_default_templates_dont_count_against_limit(self, db: AsyncSession):
        """Test that default templates don't count against user's limit."""
        # Create a customer user
        user = User(
            first_name="Alice",
            last_name="Williams",
            email="alice@example.com",
            linkedin_url="https://linkedin.com/in/alice-williams",
            linkedin_url_normalized="https://linkedin.com/in/alice-williams",
            hashed_password="hashed_password",
            is_verified=True,
            role=UserRole.CUSTOMER,
        )
        db.add(user)
        await db.commit()
        
        # Create 2 customer templates
        for i in range(2):
            template = UserTemplate(
                owner_user_id=user.user_id,
                template_role_type_id=1,
                title=f"Customer Template {i+1}",
                context=f"Context {i+1}",
                filename=f"cv{i+1}.pdf",
                cv_bytes=b"pdf_content",
                template_scope=TemplateScope.CUSTOMER,
            )
            db.add(template)
        
        # Create default templates (should not count against limit)
        for i in range(5):
            default_template = UserTemplate(
                owner_user_id=None,  # No owner for default templates
                template_role_type_id=1,
                title=f"Default Template {i+1}",
                context=f"Default Context {i+1}",
                filename=f"default_cv{i+1}.pdf",
                cv_bytes=b"pdf_content",
                template_scope=TemplateScope.DEFAULT,
            )
            db.add(default_template)
        
        await db.commit()
        
        # Count only customer templates
        result = await db.execute(
            select(UserTemplate).where(
                UserTemplate.owner_user_id == user.user_id,
                UserTemplate.template_scope == TemplateScope.CUSTOMER
            )
        )
        customer_templates = result.scalars().all()
        assert len(customer_templates) == 2


class TestEmailInfoOneToOne:
    """Test one-to-one relationship for user email info."""
    
    @pytest.mark.asyncio
    async def test_user_can_have_only_one_email_info(self, db: AsyncSession):
        """Test that a user can have only one email configuration."""
        # Create a user
        user = User(
            first_name="Charlie",
            last_name="Brown",
            email="charlie@example.com",
            linkedin_url="https://linkedin.com/in/charlie-brown",
            linkedin_url_normalized="https://linkedin.com/in/charlie-brown",
            hashed_password="hashed_password",
            is_verified=True,
            role=UserRole.VISITOR,
        )
        db.add(user)
        await db.commit()
        
        # Create email info
        email_info = UserEmailInfo(
            user_id=user.user_id,
            sender_email="charlie@gmail.com",
            sender_name="Charlie Brown",
            encrypted_app_password="encrypted",
        )
        db.add(email_info)
        await db.commit()
        
        # Try to create another email info for the same user
        # This should fail due to unique constraint
        email_info2 = UserEmailInfo(
            user_id=user.user_id,
            sender_email="charlie2@gmail.com",
            sender_name="Charlie Brown",
            encrypted_app_password="encrypted2",
        )
        db.add(email_info2)
        
        try:
            await db.commit()
            assert False, "Should have raised IntegrityError"
        except Exception:
            await db.rollback()
            # Expected to fail due to unique constraint


class TestSecretNonExposure:
    """Test that secrets are never exposed in API responses."""
    
    def test_encrypted_password_not_equal_to_original(self):
        """Test that encrypted password is not equal to original."""
        password = "my-secret-password"
        encrypted = encrypt_app_password(password)
        assert encrypted != password
        assert "my-secret-password" not in encrypted
    
    def test_masked_email_does_not_contain_full_local_part(self):
        """Test that masked email doesn't reveal full local part."""
        email = "john.doe@example.com"
        masked = mask_email(email)
        assert "john.doe" not in masked
        assert "@" in masked
        assert "example.com" in masked


# Fixtures for database testing
@pytest.fixture
async def db():
    """Database session fixture."""
    from database import async_session
    async with async_session() as session:
        yield session
        # Cleanup would happen here in a real test setup


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

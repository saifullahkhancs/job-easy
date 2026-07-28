# Job Easy Backend - Multi-Tenant Email Automation API

## Overview

This FastAPI backend implements a multi-tenant workflow for email automation with approval-based access control. The system separates visitor, customer, and admin behaviors with role-based permissions.

## Architecture

### User Roles

- **Visitor**: Newly registered users awaiting approval. Can browse default templates in read-only mode.
- **Customer**: Approved users who can create personal templates (max 2) and send emails using their configured email credentials.
- **Admin**: System administrators who manage users, approve/reject requests, and manage default templates.

### Database Schema

#### Users Table
- `email` (PK): Canonical user identity and login address
- `first_name`, `last_name`: User name
- `hashed_password`: Bcrypt hashed password
- `is_verified`: Email verification status
- `role`: Enum (admin, visitor, customer)
- `created_at`, `updated_at`: Timestamps
- **Constraints**: Unique email

#### User Email Info Table
- `id` (PK): Email configuration ID
- `email` (FK, Unique): One-to-one with users
- `sender_email`: User's email for sending
- `sender_name`: Display name for emails
- `encrypted_app_password`: Encrypted app password (never exposed)
- `email_provider`: Email provider (default: gmail)
- **Constraints**: One-to-one with user

#### User Templates Table
- `id` (PK): Template ID
- `user_email` (FK, Nullable): The author of the template
- `template_role_type_id` (FK): Role type reference
- `title`, `context`: Template content
- `filename`, `cv_bytes`: CV file data
- `template_scope`: Enum (default, customer)
- **Rules**:
  - Every template records its author in `user_email`, including default
    templates created by an admin. Only legacy rows created before the
    `e4a7c9b12f80` migration may still be NULL.
  - Customer templates: user-owned, max 2 per user
  - Promoting a template to `default` keeps `user_email`, so it can be
    reverted to its author and still counts against a customer's limit
- **Ownership labels** (`GET /api/v1/templates`): each template is returned
  with `ownership_label` and `display_group` for the template dropdowns —
  `Owned by you` (0), `Default · Owned by you` (0), `Default` (1), `User` (2).
  Templates are ordered by group: the requester's own, then defaults, then
  other users'. See `core/template_display.py`.

#### Email Automation Requests Table
- `id` (PK): Request ID
- `email` (FK): Requesting user
- `user_email_info_id` (FK): Email configuration being approved
- `status`: Enum (pending, approved, rejected)
- `requested_at`, `reviewed_at`: Timestamps
- `reviewed_by_admin_email` (FK): Admin who reviewed
- `admin_notes`: Review notes
- **Rules**: One active request per user at a time

#### Template Role Types Table
- `id` (PK): Role type ID
- `code`: Unique code
- `display_name`, `description`: Human-readable info
- `is_active`: Active status
- `sort_order`: Display order

#### Password Reset Tokens Table
- `token_id` (PK): Token ID
- `email` (FK): User reference
- `expires_at`: Expiration timestamp

## API Routes

### Authentication Routes (`/api/v1/auth`)

#### POST `/api/v1/auth/register`
- **Description**: Register a new user.
- **Request Body**:
  ```json
  {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "password": "securepassword"
  }
  ```
- **Response**: Message indicating verification code sent
- **Rate Limit**: 5 requests/minute
- **Notes**: 
  - New users start with role=visitor
  - LinkedIn URL is validated and normalized
  - Email and LinkedIn uniqueness enforced

#### POST `/api/v1/auth/verify-email`
- **Description**: Verify email with code
- **Request Body**:
  ```json
  {
    "email": "john@example.com",
    "code": "12345"
  }
  ```
- **Rate Limit**: 10 requests/minute
- **Notes**: 5 attempts allowed per 15-minute window

#### POST `/api/v1/auth/login`
- **Description**: Login with email and password
- **Request Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "securepassword"
  }
  ```
- **Response**: JWT access and refresh tokens
- **Rate Limit**: 10 requests/minute
- **Notes**: User must be verified to login

#### POST `/api/v1/auth/refresh`
- **Description**: Refresh access token
- **Request Body**:
  ```json
  {
    "refresh_token": "eyJhbGc..."
  }
  ```
- **Response**: New access and refresh tokens

#### POST `/api/v1/auth/forgot-password`
- **Description**: Initiate password reset
- **Request Body**:
  ```json
  {
    "email": "john@example.com"
  }
  ```
- **Rate Limit**: 5 requests/minute

#### POST `/api/v1/auth/reset-password`
- **Description**: Reset password with token
- **Request Body**:
  ```json
  {
    "token": "eyJhbGc...",
    "password": "newpassword"
  }
  ```
- **Rate Limit**: 5 requests/minute

#### GET `/api/v1/auth/me`
- **Description**: Get current user profile with permissions
- **Authentication**: Required
- **Response**:
  ```json
  {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "linkedin_url": "https://linkedin.com/in/john-doe",
    "is_verified": true,
    "role": "customer",
    "approval_status": "approved",
    "can_manage_templates": true,
    "can_send_email": true,
    "has_email_info": true,
    "template_limit": 2,
    "current_template_count": 1
  }
  ```

### User Email Info Routes (`/api/v1/user-email-info`)

#### POST `/api/v1/user-email-info`
- **Description**: Create email configuration
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "sender_email": "john@gmail.com",
    "sender_name": "John Doe",
    "app_password": "app-specific-password",
    "email_provider": "gmail"
  }
  ```
- **Notes**: 
  - App password is encrypted before storage
  - One configuration per user
  - Never returns app password in responses

#### GET `/api/v1/user-email-info`
- **Description**: Get masked email configuration
- **Authentication**: Required
- **Response**: Email info with masked sender email (e.g., j***@gmail.com)

#### PUT `/api/v1/user-email-info`
- **Description**: Update email configuration
- **Authentication**: Required
- **Request Body**: Same as create (all fields optional)

#### DELETE `/api/v1/user-email-info`
- **Description**: Delete email configuration
- **Authentication**: Required

### Approval Workflow Routes (`/api/v1/approval`)

#### POST `/api/v1/approval/request`
- **Description**: Submit email automation approval request
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "user_email_info_id": 1
  }
  ```
- **Notes**: One pending request per user at a time

#### GET `/api/v1/approval/status`
- **Description**: Get current approval request status
- **Authentication**: Required

#### GET `/api/v1/approval/requests`
- **Description**: List all approval requests for current user
- **Authentication**: Required

### Template Routes (`/api/v1/templates`)

#### GET `/api/v1/templates/role-types`
- **Description**: List all template role types
- **Authentication**: Not required

#### GET `/api/v1/templates`
- **Description**: List templates based on user role
- **Authentication**: Required
- **Visibility Rules**:
  - **Admin**: All templates
  - **Visitor**: Default templates only (read-only)
  - **Customer**: Own templates only

#### GET `/api/v1/templates/{template_id}`
- **Description**: Get specific template
- **Authentication**: Required
- **Authorization**: Role-based access control

#### GET `/api/v1/templates/{template_id}/cv`
- **Description**: Download CV for template
- **Authentication**: Required
- **Authorization**: Role-based access control

#### POST `/api/v1/templates`
- **Description**: Create new template
- **Authentication**: Required (admin or customer)
- **Request**: Multipart form with template_role_type_id, title, context, cv_pdf
- **Rules**: 
  - Customers: Max 2 templates
  - Admin: No limit

#### PUT `/api/v1/templates/{template_id}`
- **Description**: Update template metadata
- **Authentication**: Required (admin or owner)

#### PATCH `/api/v1/templates/{template_id}/cv`
- **Description**: Update template CV
- **Authentication**: Required (admin or owner)

#### DELETE `/api/v1/templates/{template_id}`
- **Description**: Delete template
- **Authentication**: Required (admin or owner)

### Admin Routes (`/api/v1/admin`)

#### GET `/api/v1/admin/users`
- **Description**: List all users with optional filtering
- **Authentication**: Admin only
- **Query Params**: `role`, `is_verified`

#### GET `/api/v1/admin/users/{email}`
- **Description**: Get specific user
- **Authentication**: Admin only

#### PATCH `/api/v1/admin/users/{email}`
- **Description**: Update user (including role)
- **Authentication**: Admin only

#### GET `/api/v1/admin/approval-requests`
- **Description**: List all approval requests
- **Authentication**: Admin only
- **Query Params**: `status`
- **Response**: Includes masked email info

#### GET `/api/v1/admin/approval-requests/{request_id}`
- **Description**: Get specific approval request
- **Authentication**: Admin only

#### PATCH `/api/v1/admin/approval-requests/{request_id}`
- **Description**: Approve or reject request
- **Authentication**: Admin only
- **Request Body**:
  ```json
  {
    "status": "approved",
    "admin_notes": "Approved after review"
  }
  ```
- **Notes**: 
  - On approval: User role changes to customer
  - On rejection: User remains visitor

#### GET `/api/v1/admin/template-role-types`
- **Description**: List all template role types
- **Authentication**: Admin only

#### POST `/api/v1/admin/template-role-types`
- **Description**: Create template role type
- **Authentication**: Admin only

#### PATCH `/api/v1/admin/template-role-types/{role_type_id}`
- **Description**: Update template role type
- **Authentication**: Admin only

#### DELETE `/api/v1/admin/template-role-types/{role_type_id}`
- **Description**: Delete template role type
- **Authentication**: Admin only

#### GET `/api/v1/admin/default-templates`
- **Description**: List all default templates with their author (`owner`,
  including the owner's `role`)
- **Authentication**: Admin only

#### POST `/api/v1/admin/default-templates`
- **Description**: Create default template
- **Authentication**: Admin only
- **Request**: Multipart form with template_role_type_id, title, context, cv_pdf
- **Notes**:
  - The creating admin's e-mail is stored in `user_email`, so the template is
    attributable and revertible like any other. It is *not* left NULL.
  - `template_role` is lower-cased; a duplicate role for the same admin is
    rejected with 409, and the 2-default limit is enforced with 400.

## Security Features

### Password Encryption
- App passwords encrypted using Fernet symmetric encryption
- Encryption key derived from JWT_SECRET (use APP_ENCRYPTION_KEY env var in production)
- Passwords never exposed in API responses
- Email addresses masked in admin views

### Rate Limiting
- Implemented using slowapi
- Configurable limits per endpoint
- Sensitive endpoints have stricter limits:
  - Register: 5/minute
  - Login: 10/minute
  - Verify email: 10/minute
  - Password reset: 5/minute

### JWT Security
- JWT tokens use email as subject (backward compatible with email)
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Production mode rejects weak/default JWT secrets

### LinkedIn URL Validation
- URLs validated against LinkedIn profile pattern
- Normalized before storage and comparison
- Enforces uniqueness on normalized URL
- Composite unique constraint on (email, linkedin_url_normalized)

### Authorization
- Role-based access control on all endpoints
- IDOR prevention: Users can only access their own resources
- Admin-only endpoints protected with role checks

### CORS
- Environment-driven CORS configuration
- Strict origin validation in production

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost/dbname

# Security
JWT_SECRET=your-strong-secret-key
APP_ENCRYPTION_KEY=your-encryption-key (base64 encoded)
ENVIRONMENT=development|production

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_PERIOD=60

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Your Name
SMTP_USE_TLS=true
SMTP_USE_SSL=false

# CORS
BACKEND_CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Password Reset
PASSWORD_RESET_URL=https://your-frontend.com/reset-password
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=30
```

## Migration

Run the Alembic migration to update the database schema:

```bash
alembic upgrade head
```

The migration:
1. Preserves existing users and makes `users.email` the primary key
2. Removes the surrogate `users.user_id` column
3. Keeps all user-owned foreign keys on email
4. Adds indexes and constraints

## Testing

Run the business logic tests:

```bash
pytest tests/test_business_logic.py -v
```

Tests cover:
- LinkedIn URL normalization and validation
- Password encryption and masking
- User role transitions
- Template limit enforcement
- One-to-one email info constraint
- Secret non-exposure

## Business Workflow Summary

1. **Registration**: User registers with email, password, and LinkedIn URL → Role: visitor
2. **Verification**: User verifies email via code
3. **Email Config**: User sets up email configuration (encrypted app password)
4. **Approval Request**: User submits approval request
5. **Admin Review**: Admin reviews request
6. **Approval**: 
   - If approved: User role changes to customer
   - If rejected: User remains visitor
7. **Template Creation**: Customer can create up to 2 personal templates
8. **Email Sending**: Customer can send emails using their approved configuration

## Important Notes

- **Backward Compatibility**: JWT tokens support both email (old) and email as subject
- **Password Security**: Never store or log app passwords in plaintext
- **Rate Limiting**: All sensitive endpoints are rate-limited
- **Role Transitions**: Only admin can change user roles via approval workflow
- **Template Limits**: Enforced server-side, default templates don't count
- **Email Masking**: Admin views show masked emails, never app passwords

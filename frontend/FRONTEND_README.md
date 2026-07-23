# Job Easy Frontend - Multi-Tenant Email Automation

## Overview

This React + Vite frontend implements a role-based workflow for email automation with approval-based access control. The application separates visitor, customer, and admin behaviors with role-based permissions and route guards.

## Architecture

### User Roles
- **Visitor**: Newly registered users awaiting approval. Can browse default templates in read-only mode.
- **Customer**: Approved users who can create personal templates (max 2) and send emails.
- **Admin**: System administrators (should use separate admin interface).

### Route Structure

#### Public Routes
- `/login` - Login page
- `/signup` - Registration page
- `/forgot-password` - Password reset flow

#### Authenticated Routes (`/app/*`)
- `/app` or `/app/templates` - Dashboard (role-based)
- `/app/templates/new` - Create template (customer only)
- `/app/templates/:id/edit` - Edit template (customer only)
- `/app/send` - Send email (customer only)
- `/app/request-access` - Request email automation approval (visitor)
- `/app/request-status` - Check approval status (visitor)

#### Route Guards
- **AuthGuard**: Protects all `/app/*` routes, redirects unauthenticated users to `/login`
- **RoleGuard**: Protects customer-only routes (create, edit, send), redirects visitors to `/app`

### Permission Behavior

#### Visitor Mode
- **Can Access**: `/app/templates`, `/app/request-access`, `/app/request-status`
- **Cannot Access**: `/app/templates/new`, `/app/templates/:id/edit`, `/app/send`
- **UI Behavior**:
  - Shows default templates only (read-only)
  - Shows disabled send/update/create buttons with tooltip "Available after admin approval"
  - Shows CTA to request approval
  - Displays role badge (Visitor) and approval status badge (Pending Approval)

#### Customer Mode
- **Can Access**: All authenticated routes
- **UI Behavior**:
  - Shows personal templates (max 2) and default templates
  - Shows enabled send/update/create buttons
  - Hides visitor lock messaging
  - Displays role badge (Customer) and approval status badge (Approved)
  - Enforces template limit in UI (backend is final authority)

#### Admin Mode
- **Can Access**: Basic authenticated routes (should use separate admin interface)
- **UI Behavior**: Shows message directing to admin interface

## Components

### Auth Components
- **AuthGuard**: Checks authentication status, redirects to login if not authenticated
- **RoleGuard**: Checks user role, redirects if not in allowed roles
- **RoleBadge**: Displays role with color-coded badge (Visitor/Customer/Admin)
- **ApprovalStatusBadge**: Displays approval status with color-coded badge (Pending/Approved/Rejected)

### Layout Components
- **Layout**: Main app layout with role-based navigation
  - Visitor navigation: Templates, Request Access
  - Customer navigation: Templates, Send Email
  - Shows user info with role and approval badges
  - Logout functionality

### Page Components

#### Auth Pages
- **LoginPage**: Login with email/password, stores JWT tokens
- **SignupPage**: Registration with email and password, email verification flow
- **ForgotPasswordPage**: Password reset flow

#### Dashboard
- **DashboardPage**: Role-based template display
  - Visitor: Default templates only, read-only, disabled actions
  - Customer: Personal templates (max 2) + default templates, full actions
  - Empty state for customers with no templates: "Your account is approved. No personal templates are available yet. Create your first template."

#### Approval Workflow
- **RequestAccessPage**: Gmail app password setup with live preview
  - Instructions for creating Gmail app password
  - Security note about encryption
  - Live preview: `John Doe <john@example.com>`
  - Multi-step: Setup → Confirm → Submit
- **RequestStatusPage**: Check approval request status
  - Shows request details and admin notes
  - Refresh status button
  - Navigation based on status (approved → dashboard, rejected → new request)

#### Template Management
- **TemplateCreatePage**: Create new template (customer only)
  - Uses template_role as a unique identifier (direct input, not dropdown)
  - Enforces template limit in UI (max 2 personal templates)
  - Upload CV (PDF)
- **TemplateEditPage**: Edit existing template (customer only)
  - Safe patch mode (select fields to update)
  - Cannot change template_role after creation
- **SendPage**: Send email using template (customer only)
  - Shows only personal templates
  - Empty state if no templates

## API Service Layer

### Auth API
- `register(firstName, lastName, email, password)` - Register a new user
- `verifyEmail(email, code)` - Verify email with code
- `resendVerification(email)` - Resend verification code
- `login(email, password)` - Login and get tokens
- `forgotPassword(email)` - Initiate password reset
- `resetPassword(token, password)` - Reset password with token
- `refreshToken(refreshToken)` - Refresh access token
- `getCurrentUser()` - Get current user profile with permissions
- `logout()` - Clear tokens from localStorage

### Email Info API
- `createEmailInfo(senderEmail, senderName, appPassword, emailProvider)` - Create email config
- `getEmailInfo()` - Get masked email config
- `updateEmailInfo(senderEmail, senderName, appPassword, emailProvider)` - Update email config
- `deleteEmailInfo()` - Delete email config

### Approval Workflow API
- `submitApprovalRequest(userEmailInfoId)` - Submit approval request
- `getApprovalStatus()` - Get current approval status
- `listMyRequests()` - List all approval requests

### Template API (v2)
- `fetchTemplatesV2()` - Get templates (role-based visibility)
- `fetchTemplateV2(templateId)` - Get specific template
- `getCvUrlV2(templateId)` - Get CV URL
- `fetchCvBlobUrlV2(templateId)` - Get CV as blob URL
- `createTemplateV2(formData)` - Create template (template_role, title, context, cv_pdf)
- `updateTemplateV2(templateId, formData)` - Update template metadata
- `updateTemplateCvV2(templateId, cvPdf)` - Update template CV
- `deleteTemplateV2(templateId)` - Delete template

## Security Features

### Token Handling
- JWT tokens stored in localStorage (access_token, refresh_token)
- Tokens sent in Authorization header for authenticated requests
- Logout clears tokens from localStorage
- Structured for future migration to HttpOnly cookies

### Password Security
- App passwords never displayed after save
- App passwords never stored in localStorage
- App passwords never logged to console
- Security note displayed about encryption

### Route Protection
- AuthGuard prevents unauthenticated access
- RoleGuard prevents unauthorized role access
- Conditional rendering based on user role
- Backend is final authority for all permissions

## UX Features

### Role Badges
- Visitor: Yellow badge with clock icon
- Customer: Blue badge with shield icon
- Admin: Purple badge with shield icon

### Approval Status Badges
- Pending: Yellow badge with clock icon
- Approved: Green badge with check circle icon
- Rejected: Red badge with X circle icon

### Disabled Button Tooltips
- Visitor disabled buttons显示: "Available after admin approval"
- Clear visual indication of locked features

### Empty States
- Visitor no templates: "No Templates Available - Default templates will appear here once added by the admin"
- Customer no templates: "Your account is approved. No personal templates are available yet. Create your first template."
- Send page no templates: "No personal templates available. Create a template first to send emails."

### Loading States
- All async operations show loading indicators
- AuthGuard shows loading while checking authentication
- RoleGuard shows loading while checking role

### Error States
- API errors displayed with user-friendly messages
- Form validation errors shown inline
- Network errors handled gracefully

## Business Workflow Summary

1. **Registration**: User registers with email and password → Role: visitor
2. **Verification**: User verifies email via code
3. **Email Config**: User sets up email configuration with Gmail app password
4. **Approval Request**: User submits approval request with live preview
5. **Admin Review**: Admin reviews request (separate admin interface)
6. **Approval**: 
   - If approved: User role changes to customer
   - If rejected: User remains visitor, can submit new request
7. **Template Creation**: Customer can create up to 2 personal templates using template_role (direct input)
8. **Email Sending**: Customer can send emails using their approved configuration

## Important Notes

- **Backend Authority**: UI enforces limits but backend is final authority
- **Template Limits**: Default templates don't count against customer's 2-template limit
- **Template Role**: Templates use template_role as a unique identifier per user (or globally for default templates)
- **Role Transitions**: Only admin can change user roles via approval workflow
- **Route Guards**: Prevent visitors from accessing customer-only routes
- **Conditional Rendering**: Prevents visitors from seeing customer-only actions
- **No Template Role Types**: Template role types have been removed; template_role is now a direct string field

## File Structure

```
frontend/src/
├── api/
│   └── client.js                    # API service layer
├── components/
│   ├── Layout.jsx                   # Main layout with role-based nav
│   ├── AuthGuard.jsx                # Authentication guard
│   ├── RoleGuard.jsx                # Role-based guard
│   └── RoleBadge.jsx                # Role and approval status badges
├── pages/
│   ├── LoginPage.jsx                # Login page
│   ├── SignupPage.jsx               # Signup with LinkedIn URL
│   ├── ForgotPasswordPage.jsx       # Password reset
│   ├── DashboardPage.jsx            # Role-based dashboard
│   ├── RequestAccessPage.jsx        # Gmail app password setup
│   ├── RequestStatusPage.jsx        # Approval status check
│   ├── TemplateCreatePage.jsx       # Create template (customer)
│   ├── TemplateEditPage.jsx         # Edit template (customer)
│   ├── SendPage.jsx                 # Send email (customer)
│   ├── UploadPage.jsx               # Legacy upload page
│   ├── ViewPage.jsx                 # Legacy view page
│   └── PatchPage.jsx                # Legacy patch page
├── App.jsx                          # Routing configuration
├── main.jsx                         # App entry point
└── index.css                        # Global styles
```

## Environment Variables

```bash
# API Base URL (for production)
VITE_API_URL=http://localhost:8000
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Dependencies

- React 19.2.7
- React Router DOM 7.18.1
- Lucide React 1.25.0
- Vite 8.1.1

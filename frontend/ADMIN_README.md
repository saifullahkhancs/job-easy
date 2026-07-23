# Job Easy Admin Frontend - Administration Panel

## Overview

This React + Vite admin interface provides a clearly separated experience for managing the Job Easy multi-tenant email automation system. The admin panel is completely separate from the client/user experience with its own layout and navigation.

## Architecture

### Separation from Client App
- **Separate entrypoint**: `/admin` vs `/app`
- **Separate layout**: AdminLayout vs Layout
- **Separate API client**: adminClient.js vs client.js
- **No authentication**: Admin dashboard is intentionally open for internal/dev-only use

### Admin Route Structure

#### Admin Routes (No Authentication - Internal/Dev-Only)
- `/admin` - Admin dashboard with statistics
- `/admin/dashboard` - Admin dashboard with statistics
- `/admin/requests` - Approval request management
- `/admin/users` - User management
- `/admin/default-templates` - Default template management

### Security Warning
The admin dashboard at `/admin` is intentionally accessible without authentication for internal development and testing purposes. **This is not safe for public exposure.** In a production environment, you must implement proper authentication and authorization for the admin panel.

## Admin Pages

### Admin Dashboard (`/admin/dashboard`)
- **Statistics Display**:
  - Total users count
  - Visitors count
  - Customers count
  - Pending requests count
  - Rejected requests count
- **Quick Actions**:
  - Review pending requests
  - Manage users
  - Manage default templates
- **Alert Banner**: Shows when pending requests need review

### Admin Requests Page (`/admin/requests`)
- **Features**:
  - Table/list of approval requests
  - Filter by status (all, pending, approved, rejected)
  - User info display
  - Masked sender email display
  - Sender display name display
  - Requested timestamp
  - Actions: Approve/Reject (pending only)
  - View admin notes (rejected requests)
- **Approval Workflow**:
  - Approve: Changes visitor → customer
  - Reject: Requires admin note
  - Prevents duplicate actions on processed requests
- **Security**: Never shows raw app passwords

### Admin Users Page (`/admin/users`)
- **Features**:
  - List all users
  - Search by name or email
  - Filter by role (visitor, customer, admin)
  - Filter by verification status
  - Display role badges
  - Display verification badges
  - Edit user role and verification status
- **User Management**:
  - Change user role (visitor ↔ customer ↔ admin)
  - Toggle verification status
  - Confirmation modal before changes
- **Security**: No access to user passwords or app passwords

### Admin Default Templates Page (`/admin/default-templates`)
- **Features**:
  - List all default templates
  - Create new default templates
  - Edit existing templates
  - Delete templates
  - View template details
  - Preview title/body/CV metadata
- **Template Management**:
  - Uses template_role as a unique identifier (direct input)
  - Upload CV (PDF)
  - Mark as system default (owner = null)
  - These templates are what visitors browse before approval
- **Security**: Admin-only access, proper authorization

## Admin API Service Layer

### Dashboard API
- `getAdminStats()` - Get dashboard statistics

### Users API
- `listAdminUsers(role, isVerified)` - List users with filters
- `getAdminUser(userId)` - Get specific user
- `updateAdminUser(userId, userData)` - Update user role/status

### Approval Requests API
- `listAdminRequests(status)` - List approval requests
- `getAdminRequest(requestId)` - Get specific request
- `reviewAdminRequest(requestId, reviewData)` - Approve/reject request

### Default Templates API
- `listAdminDefaultTemplates()` - List default templates
- `createAdminDefaultTemplate(formData)` - Create default template (template_role, title, context, cv_pdf)
- `getAdminTemplate(templateId)` - Get template details
- `updateAdminTemplate(templateId, formData)` - Update template metadata
- `updateAdminTemplateCv(templateId, cvPdf)` - Update template CV
- `deleteAdminTemplate(templateId)` - Delete template
- `getAdminTemplateCvUrl(templateId)` - Get CV URL

## Security Features

### Data Protection
- Never displays raw app passwords
- Never displays user passwords
- Shows masked sender emails only
- No logging of sensitive values in browser console
- Backend provides masked data in safe format

### Audit Trail
- Displays reviewed_by, reviewed_at, admin_notes if backend provides
- Admin notes required for rejection
- Timestamps for all actions

## UI Features

### Admin Layout
- Separate sidebar from client app
- Admin-specific branding (shield icon, "Admin Panel" badge)
- Collapsible sidebar
- Header with admin branding

### Status Badges
- Role badges: Admin (purple), Customer (blue), Visitor (yellow)
- Verification badges: Verified (green), Unverified (gray)
- Status badges: Pending (yellow), Approved (green), Rejected (red), Active (green), Inactive (gray)

### Confirmation Modals
- Confirm before approve/reject actions
- Confirm before user role changes
- Confirm before template deletion

### Success/Error Feedback
- Toast notifications for all mutations
- Inline error messages
- Success messages after actions

### Empty States
- No requests found
- No users found
- No default templates

### Loading States
- Loading indicators for async operations
- Disabled buttons during actions
- Loading states for table data

## File Structure

```
frontend/src/
├── admin/
│   ├── AdminLayout.jsx             # Admin-specific layout
│   ├── AdminDashboardPage.jsx      # Dashboard with stats
│   ├── AdminRequestsPage.jsx       # Approval request management
│   ├── AdminUsersPage.jsx          # User management
│   └── AdminDefaultTemplatesPage.jsx  # Default templates
├── api/
│   ├── client.js                   # Client API service
│   └── adminClient.js              # Admin API service
├── components/
│   ├── Layout.jsx                  # Client layout
│   ├── AuthGuard.jsx               # Client auth guard
│   ├── RoleGuard.jsx               # Client role guard
│   └── RoleBadge.jsx               # Role/status badges
└── App.jsx                        # Main routing (includes both)
```

## Route Map and Permission Behavior

### Admin Routes (No Authentication - Internal/Dev-Only)
| Route | Access | Description |
|-------|--------|-------------|
| `/admin` | Open | Admin dashboard |
| `/admin/dashboard` | Open | Dashboard with statistics |
| `/admin/requests` | Open | Approval request management |
| `/admin/users` | Open | User management |
| `/admin/default-templates` | Open | Default template management |

### Client Routes (for reference)
| Route | Access | Description |
|-------|--------|-------------|
| `/login` | Public | User login page |
| `/signup` | Public | User registration |
| `/app` | Authenticated | Client dashboard |
| `/app/templates` | Authenticated | Template management |
| `/app/templates/new` | Customer only | Create template |
| `/app/send` | Customer only | Send email |
| `/app/request-access` | Visitor only | Request approval |

## Important Notes

### Security Warning
The admin dashboard at `/admin` is intentionally accessible without authentication for internal development and testing purposes. **This is not safe for public exposure.** In a production environment, you must implement proper authentication and authorization for the admin panel.

### Template Role
- Templates use `template_role` as a unique identifier per user (or globally for default templates)
- Template role types have been removed
- template_role is now a direct string field, not managed via a separate table

### Backend Authority
- UI enforces limits but backend is final authority
- All mutations validated by backend
- Role changes trigger backend approval workflow
- Template limits enforced by backend (max 2 per customer)

### Security Best Practices
- Never store or display sensitive data
- Mask all email addresses in admin views
- Require admin notes for rejection
- Log all admin actions (backend responsibility)
- Use HTTPS in production

### Future Enhancements
- Analytics dashboard
- Audit log viewer
- Bulk user actions
- Advanced filtering
- Export functionality
- Email notification settings
- System configuration management

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

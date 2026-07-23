import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import RoleGuard, { ROLES } from "./components/RoleGuard";
import Layout from "./components/Layout";
import AdminLayout from "./admin/AdminLayout";
import UploadPage from "./pages/UploadPage";
import ViewPage from "./pages/ViewPage";
import SendPage from "./pages/SendPage";
import PatchPage from "./pages/PatchPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import RequestAccessPage from "./pages/RequestAccessPage";
import RequestStatusPage from "./pages/RequestStatusPage";
import DashboardPage from "./pages/DashboardPage";
import TemplateCreatePage from "./pages/TemplateCreatePage";
import TemplateEditPage from "./pages/TemplateEditPage";
import AdminDashboardPage from "./admin/AdminDashboardPage";
import AdminRequestsPage from "./admin/AdminRequestsPage";
import AdminUsersPage from "./admin/AdminUsersPage";
import AdminDefaultTemplatesPage from "./admin/AdminDefaultTemplatesPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        
        {/* Admin routes - no auth guard (internal/dev-only) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="requests" element={<AdminRequestsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="default-templates" element={<AdminDefaultTemplatesPage />} />
        </Route>
        
        {/* Protected authenticated routes */}
        <Route element={<AuthGuard />}>
          <Route path="/app" element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="templates" element={<DashboardPage />} />
            
            {/* Template create, edit, and send pages (now accessible but disabled for guests/visitors) */}
            <Route path="templates/new" element={<TemplateCreatePage />} />
            <Route path="templates/:id/edit" element={<TemplateEditPage />} />
            <Route path="send" element={<SendPage />} />
            
            {/* Visitor routes */}
            <Route path="request-access" element={<RequestAccessPage />} />
            <Route path="request-status" element={<RequestStatusPage />} />
          </Route>
        </Route>
        
        {/* Legacy route redirects */}
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/view" element={<Navigate to="/app/templates" replace />} />
        <Route path="/update" element={<Navigate to="/app/templates" replace />} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

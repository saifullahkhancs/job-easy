import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, Send, Lock, ArrowRight, AlertCircle, FileText } from "lucide-react";
import { getCurrentUser, fetchTemplatesV2, getTemplateRoleTypes } from "../api/client";
import { RoleBadge, ApprovalStatusBadge } from "../components/RoleBadge";
import { ROLES } from "../components/RoleGuard";

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [roleTypes, setRoleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [user, templatesData, roleTypesData] = await Promise.all([
        getCurrentUser(),
        fetchTemplatesV2(),
        getTemplateRoleTypes()
      ]);
      setCurrentUser(user);
      setTemplates(templatesData);
      setRoleTypesData(roleTypesData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const setRoleTypesData = (data) => {
    // Handle different response formats
    if (data.role_types) {
      setRoleTypes(data.role_types);
    } else if (Array.isArray(data)) {
      setRoleTypes(data);
    }
  };

  const isVisitor = currentUser?.role === ROLES.VISITOR;
  const isCustomer = currentUser?.role === ROLES.CUSTOMER;
  const isAdmin = currentUser?.role === ROLES.ADMIN;

  const handleViewTemplate = (templateId) => {
    navigate(`/app/templates/${templateId}`);
  };

  const handleCreateTemplate = () => {
    navigate("/app/templates/new");
  };

  const handleSendEmail = () => {
    navigate("/app/send");
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  // Visitor mode - read-only default templates
  if (isVisitor) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Template Gallery</h1>
          <div className="header-badges">
            <RoleBadge role={currentUser.role} />
            <ApprovalStatusBadge status={currentUser.approval_status} />
          </div>
        </div>

        <div className="visitor-banner">
          <Lock size={24} className="banner-icon" />
          <div className="banner-content">
            <h3>Visitor Mode</h3>
            <p>Browse default templates in read-only mode. Request approval to create your own templates and send emails.</p>
            <button 
              className="primary-btn"
              onClick={() => navigate("/app/request-access")}
            >
              Request Approval
              <ArrowRight size={20} className="btn-icon" />
            </button>
          </div>
        </div>

        <div className="templates-grid">
          {templates.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} className="empty-icon" />
              <h3>No Templates Available</h3>
              <p>Default templates will appear here once added by the admin.</p>
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="template-card visitor-card">
                <div className="template-header">
                  <h3>{template.title}</h3>
                  <span className="template-badge">Default</span>
                </div>
                <p className="template-context">{template.context}</p>
                <div className="template-footer">
                  <button 
                    className="icon-btn"
                    onClick={() => handleViewTemplate(template.id)}
                    title="View Details"
                  >
                    <Eye size={20} />
                  </button>
                  <button 
                    className="icon-btn disabled"
                    disabled
                    title="Available after admin approval"
                  >
                    <Send size={20} />
                  </button>
                  <button 
                    className="icon-btn disabled"
                    disabled
                    title="Available after admin approval"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Customer mode - full features
  if (isCustomer) {
    const personalTemplates = templates.filter(t => t.template_scope === "customer");
    const defaultTemplates = templates.filter(t => t.template_scope === "default");
    const canCreateMore = currentUser.current_template_count < currentUser.template_limit;

    return (
      <div className="page-container">
        <div className="page-header">
          <h1>My Templates</h1>
          <div className="header-badges">
            <RoleBadge role={currentUser.role} />
            <ApprovalStatusBadge status={currentUser.approval_status} />
          </div>
        </div>

        {/* Personal Templates Section */}
        <div className="section-header">
          <h2>Personal Templates ({currentUser.current_template_count}/{currentUser.template_limit})</h2>
          {canCreateMore && (
            <button 
              className="primary-btn"
              onClick={handleCreateTemplate}
            >
              <Plus size={20} className="btn-icon" />
              Create Template
            </button>
          )}
        </div>

        {personalTemplates.length === 0 ? (
          <div className="empty-state customer-empty">
            <FileText size={48} className="empty-icon" />
            <h3>Your account is approved. No personal templates are available yet.</h3>
            <p>Create your first template to get started with email automation.</p>
            {canCreateMore && (
              <button 
                className="primary-btn"
                onClick={handleCreateTemplate}
              >
                <Plus size={20} className="btn-icon" />
                Create Your First Template
              </button>
            )}
          </div>
        ) : (
          <div className="templates-grid">
            {personalTemplates.map((template) => (
              <div key={template.id} className="template-card">
                <div className="template-header">
                  <h3>{template.title}</h3>
                  <span className="template-badge personal">Personal</span>
                </div>
                <p className="template-context">{template.context}</p>
                <div className="template-footer">
                  <button 
                    className="icon-btn"
                    onClick={() => handleViewTemplate(template.id)}
                    title="View Details"
                  >
                    <Eye size={20} />
                  </button>
                  <button 
                    className="icon-btn"
                    onClick={() => navigate(`/app/templates/${template.id}/edit`)}
                    title="Edit Template"
                  >
                    <Plus size={20} />
                  </button>
                  <button 
                    className="icon-btn"
                    onClick={handleSendEmail}
                    title="Send Email"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Default Templates Section */}
        {defaultTemplates.length > 0 && (
          <>
            <div className="section-header">
              <h2>Default Templates</h2>
              <p className="section-description">System templates provided by admin (read-only)</p>
            </div>
            <div className="templates-grid">
              {defaultTemplates.map((template) => (
                <div key={template.id} className="template-card default-card">
                  <div className="template-header">
                    <h3>{template.title}</h3>
                    <span className="template-badge default">Default</span>
                  </div>
                  <p className="template-context">{template.context}</p>
                  <div className="template-footer">
                    <button 
                      className="icon-btn"
                      onClick={() => handleViewTemplate(template.id)}
                      title="View Details"
                    >
                      <Eye size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Template Limit Warning */}
        {!canCreateMore && (
          <div className="limit-warning">
            <AlertCircle size={20} className="warning-icon" />
            <p>You've reached your maximum of {currentUser.template_limit} personal templates. Delete an existing template to create a new one.</p>
          </div>
        )}
      </div>
    );
  }

  // Admin mode - redirect to admin interface (not implemented in this frontend)
  if (isAdmin) {
    return (
      <div className="page-container">
        <div className="info-banner">
          <AlertCircle size={20} className="banner-icon" />
          <div>
            <h3>Admin Access</h3>
            <p>Admin users should use the admin interface for management tasks.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="error-state">Unable to determine user role</div>
    </div>
  );
}

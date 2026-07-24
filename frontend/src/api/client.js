// Use relative URLs in dev (Vite proxies /api to the backend).
// Set VITE_API_URL for production builds, e.g. http://127.0.0.1:8000
const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const { detail } = data;
    let message = "Request failed";
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((item) => item.msg).join(", ");
    } else if (data.message) {
      message = data.message;
    }
    throw new Error(message);
  }
  return data;
}

export async function fetchJobTypes() {
  const response = await fetch(`${API_BASE}/api/job-types`);
  const data = await handleResponse(response);
  return data.job_types;
}

export async function fetchTemplates() {
  const response = await fetch(`${API_BASE}/api/templates`);
  const data = await handleResponse(response);
  return data.templates;
}

export async function fetchTemplate(type) {
  const response = await fetch(`${API_BASE}/api/templates/${encodeURIComponent(type)}`);
  return handleResponse(response);
}

export function getCvUrl(type) {
  return `${API_BASE}/api/templates/${encodeURIComponent(type)}/cv`;
}

export async function fetchCvBlobUrl(type) {
  const response = await fetch(getCvUrl(type));
  if (!response.ok) {
    throw new Error("Failed to load CV preview");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function createTemplate(formData) {
  const response = await fetch(`${API_BASE}/api/templates`, {
    method: "POST",
    body: formData,
  });
  return handleResponse(response);
}

export async function patchTemplate(type, formData) {
  const response = await fetch(`${API_BASE}/api/templates/${encodeURIComponent(type)}`, {
    method: "PATCH",
    body: formData,
  });
  return handleResponse(response);
}

export async function sendEmail(recipientEmail, type) {
  const response = await fetch(`${API_BASE}/api/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_email: recipientEmail, type }),
  });
  return handleResponse(response);
}

// Auth API functions
export async function register(firstName, lastName, email, password, linkedinUrl) {
  const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password, linkedin_url: linkedinUrl }),
  });
  return handleResponse(response);
}

export async function verifyEmail(email, code) {
  const response = await fetch(`${API_BASE}/api/v1/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  return handleResponse(response);
}

export async function resendVerification(email) {
  const response = await fetch(`${API_BASE}/api/v1/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
}

export async function forgotPassword(email) {
  const response = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
}

export async function resetPassword(token, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  return handleResponse(response);
}

export async function refreshToken(refreshToken) {
  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return handleResponse(response);
}

// Get current user profile
const _userCache = { data: null, timestamp: 0 };
const USER_CACHE_TTL = 30_000; // 30 seconds

export async function getCurrentUser() {
  if (_userCache.data && Date.now() - _userCache.timestamp < USER_CACHE_TTL) {
    return _userCache.data;
  }
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await handleResponse(response);
  _userCache.data = data;
  _userCache.timestamp = Date.now();
  return data;
}

// Email Info API
export async function createEmailInfo(senderEmail, senderName, appPassword, emailProvider = "gmail") {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/user-email-info`, {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sender_email: senderEmail, sender_name: senderName, app_password: appPassword, email_provider: emailProvider }),
  });
  return handleResponse(response);
}

export async function getEmailInfo() {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/user-email-info`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

export async function updateEmailInfo(senderEmail, senderName, appPassword, emailProvider) {
  const token = localStorage.getItem("access_token");
  const body = {};
  if (senderEmail !== undefined) body.sender_email = senderEmail;
  if (senderName !== undefined) body.sender_name = senderName;
  if (appPassword !== undefined) body.app_password = appPassword;
  if (emailProvider !== undefined) body.email_provider = emailProvider;
  
  const response = await fetch(`${API_BASE}/api/v1/user-email-info`, {
    method: "PUT",
    headers: { 
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

export async function deleteEmailInfo() {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/user-email-info`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

// Approval Workflow API
export async function submitApprovalRequest(userEmailInfoId) {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/approval/request`, {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_email_info_id: userEmailInfoId }),
  });
  return handleResponse(response);
}

export async function getApprovalStatus() {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/approval/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

export async function listMyRequests() {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/approval/requests`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

// Updated Template API (v2)
export async function fetchTemplatesV2() {
  const token = localStorage.getItem("access_token");
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/v1/templates`, {
    headers,
  });
  return handleResponse(response);
}

export async function fetchTemplateV2(templateId) {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

export async function getCvUrlV2(templateId) {
  const token = localStorage.getItem("access_token");
  return `${API_BASE}/api/v1/templates/${templateId}/cv?token=${token}`;
}

export async function fetchCvBlobUrlV2(templateId) {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}/cv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Failed to load CV preview");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function createTemplateV2(formData) {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return handleResponse(response);
}

export async function updateTemplateV2(templateId, formData) {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });
  return handleResponse(response);
}

export async function updateTemplateCvV2(templateId, cvPdf) {
  const token = localStorage.getItem("access_token");
  const formData = new FormData();
  formData.append("cv_pdf", cvPdf);
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}/cv`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return handleResponse(response);
}

export async function deleteTemplateV2(templateId) {
  const token = localStorage.getItem("access_token");
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

// Logout helper
export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  _userCache.data = null;
  _userCache.timestamp = 0;
}

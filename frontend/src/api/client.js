// Use relative URLs in dev (Vite proxies /api to the backend).
// Set VITE_API_URL for production builds, e.g. http://127.0.0.1:8000
import {
  clearStoredSession,
  maybeNotifySessionExpired,
  resetSessionExpiredState,
} from "./session";
import {
  getAccessToken,
  getRefreshToken,
} from "./tokenStorage";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const { detail } = data;
    const sessionExpired = maybeNotifySessionExpired(response, data);
    let message = sessionExpired ? "Your session has expired. Please log in again." : "Request failed";
    if (!sessionExpired && typeof detail === "string") {
      message = detail;
    } else if (!sessionExpired && Array.isArray(detail)) {
      message = detail.map((item) => item.msg).join(", ");
    } else if (!sessionExpired && data.message) {
      message = data.message;
    }
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
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

export async function sendEmail(recipientEmail, templateId) {
  const token = getAccessToken();
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE}/api/v1/email/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      recipient_email: recipientEmail,
      template_id: Number(templateId),
    }),
  });
  return handleResponse(response);
}

// Legacy wrapper kept for any old callers — maps old /api/send to new endpoint
export async function sendEmailLegacy(recipientEmail, type) {
  // type was old job-type string; now we expect templateId, so this is deprecated
  return sendEmail(recipientEmail, type);
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
  const data = await handleResponse(response);
  resetSessionExpiredState();
  return data;
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

export async function refreshToken(refreshTokenValue) {
  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshTokenValue }),
  });
  return handleResponse(response);
}

// Get current user profile
const _userCache = { data: null, timestamp: 0, token: null };
const USER_CACHE_TTL = 30_000; // 30 seconds

export async function getCurrentUser() {
  const token = getAccessToken();
  // Invalidate cache if token changed (important for multi-tab with different accounts)
  if (
    _userCache.data &&
    Date.now() - _userCache.timestamp < USER_CACHE_TTL &&
    _userCache.token === token
  ) {
    return _userCache.data;
  }
  const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await handleResponse(response);
  _userCache.data = data;
  _userCache.timestamp = Date.now();
  _userCache.token = token;
  return data;
}

// Email Info API
export async function createEmailInfo(senderEmail, senderName, apiKey, emailProvider = "resend") {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/api/v1/user-email-info`, {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sender_email: senderEmail, sender_name: senderName, api_key: apiKey, email_provider: emailProvider }),
  });
  return handleResponse(response);
}

export async function getEmailInfo() {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/api/v1/user-email-info`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

export async function updateEmailInfo(senderEmail, senderName, apiKey, emailProvider) {
  const token = getAccessToken();
  const body = {};
  if (senderEmail !== undefined) body.sender_email = senderEmail;
  if (senderName !== undefined) body.sender_name = senderName;
  if (apiKey !== undefined) body.api_key = apiKey;
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
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/api/v1/user-email-info`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

// Approval Workflow API
export async function submitApprovalRequest(userEmailInfoId) {
  const token = getAccessToken();
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
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/api/v1/approval/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

export async function listMyRequests() {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/api/v1/approval/requests`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

// Updated Template API (v2)
export async function fetchTemplatesV2() {
  const token = getAccessToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/v1/templates`, {
    headers,
  });
  return handleResponse(response);
}

export async function fetchTemplateV2(templateId) {
  const token = getAccessToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}`, {
    headers,
  });
  return handleResponse(response);
}

export async function getCvUrlV2(templateId) {
  const token = getAccessToken();
  if (token) {
    return `${API_BASE}/api/v1/templates/${templateId}/cv?token=${token}`;
  }
  return `${API_BASE}/api/v1/templates/${templateId}/cv`;
}

export async function fetchCvBlobUrlV2(templateId) {
  const token = getAccessToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}/cv`, {
    headers,
  });
  if (!response.ok) {
    throw new Error("Failed to load CV preview");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function createTemplateV2(formData) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/api/v1/templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return handleResponse(response);
}

export async function updateTemplateV2(templateId, formData) {
  const token = getAccessToken();
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
  const token = getAccessToken();
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
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

// Logout helper – clears user cache and tokens
export function logout() {
  clearStoredSession();
  _userCache.data = null;
  _userCache.timestamp = 0;
  _userCache.token = null;
}

// Also export token helpers for convenience
export { getAccessToken, getRefreshToken } from "./tokenStorage";

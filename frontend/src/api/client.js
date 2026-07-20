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
export async function register(firstName, lastName, email, password) {
  const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password }),
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

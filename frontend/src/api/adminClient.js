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

const getHeaders = (extraHeaders = {}) => {
  const token = localStorage.getItem("access_token");
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return {
    ...headers,
    ...extraHeaders,
  };
};

// Admin Dashboard Stats
export async function getAdminStats() {
  const response = await fetch(`${API_BASE}/api/v1/admin/dashboard`, {
    headers: getHeaders(),
  });
  return handleResponse(response);
}

// Admin Users API
export async function listAdminUsers(role, isVerified) {
  const params = new URLSearchParams();
  if (role) params.append("role", role);
  if (isVerified !== undefined) params.append("is_verified", isVerified);
  
  const response = await fetch(`${API_BASE}/api/v1/admin/users?${params}`, {
    headers: getHeaders(),
  });
  return handleResponse(response);
}

export async function getAdminUser(userId) {
  const response = await fetch(`${API_BASE}/api/v1/admin/users/${userId}`, {
    headers: getHeaders(),
  });
  return handleResponse(response);
}

export async function updateAdminUser(userId, userData) {
  const response = await fetch(`${API_BASE}/api/v1/admin/users/${userId}`, {
    method: "PATCH",
    headers: getHeaders({ 
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(userData),
  });
  return handleResponse(response);
}

// Admin Approval Requests API
export async function listAdminRequests(status) {
  const params = status ? `?status=${status}` : "";
  const response = await fetch(`${API_BASE}/api/v1/admin/approval-requests${params}`, {
    headers: getHeaders(),
  });
  return handleResponse(response);
}

export async function getAdminRequest(requestId) {
  const response = await fetch(`${API_BASE}/api/v1/admin/approval-requests/${requestId}`, {
    headers: getHeaders(),
  });
  return handleResponse(response);
}

export async function reviewAdminRequest(requestId, reviewData) {
  const response = await fetch(`${API_BASE}/api/v1/admin/approval-requests/${requestId}`, {
    method: "PATCH",
    headers: getHeaders({ 
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(reviewData),
  });
  return handleResponse(response);
}

// Admin Default Templates API
export async function listAdminDefaultTemplates() {
  const response = await fetch(`${API_BASE}/api/v1/admin/default-templates`, {
    headers: getHeaders(),
  });
  return handleResponse(response);
}

export async function createAdminDefaultTemplate(formData) {
  const response = await fetch(`${API_BASE}/api/v1/admin/default-templates`, {
    method: "POST",
    headers: getHeaders(),
    body: formData,
  });
  return handleResponse(response);
}

export async function getAdminTemplate(templateId) {
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}`, {
    headers: getHeaders(),
  });
  return handleResponse(response);
}

export async function updateAdminTemplate(templateId, formData) {
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}`, {
    method: "PUT",
    headers: getHeaders({ 
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(formData),
  });
  return handleResponse(response);
}

export async function updateAdminTemplateCv(templateId, cvPdf) {
  const formData = new FormData();
  formData.append("cv_pdf", cvPdf);
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}/cv`, {
    method: "PATCH",
    headers: getHeaders(),
    body: formData,
  });
  return handleResponse(response);
}

export async function deleteAdminTemplate(templateId) {
  const response = await fetch(`${API_BASE}/api/v1/templates/${templateId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return handleResponse(response);
}

export async function getAdminTemplateCvUrl(templateId) {
  return `${API_BASE}/api/v1/templates/${templateId}/cv`;
}

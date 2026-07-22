import { Shield, Clock, CheckCircle, XCircle } from "lucide-react";

const ROLE_CONFIG = {
  visitor: { label: "Visitor", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  customer: { label: "Customer", color: "bg-blue-100 text-blue-800", icon: Shield },
  admin: { label: "Admin", color: "bg-purple-100 text-purple-800", icon: Shield },
};

const APPROVAL_CONFIG = {
  pending: { label: "Pending Approval", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved: { label: "Approved", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
};

export function RoleBadge({ role }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.visitor;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
      <Icon size={14} />
      {config.label}
    </span>
  );
}

export function ApprovalStatusBadge({ status }) {
  const config = APPROVAL_CONFIG[status] || APPROVAL_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
      <Icon size={14} />
      {config.label}
    </span>
  );
}

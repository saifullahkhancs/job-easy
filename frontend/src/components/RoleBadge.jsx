import { Shield, Clock, CheckCircle, XCircle, UserCircle } from "lucide-react";

const ROLE_CONFIG = {
  visitor: { label: "Visitor", color: "badge-yellow", icon: Clock },
  customer: { label: "Customer", color: "badge-blue", icon: Shield },
  admin: { label: "Admin", color: "badge-purple", icon: Shield },
};

const APPROVAL_CONFIG = {
  none: { label: "Visitor", color: "badge-gray", icon: UserCircle },
  pending: { label: "Pending Approval", color: "badge-yellow", icon: Clock },
  approved: { label: "Approved", color: "badge-green", icon: CheckCircle },
  rejected: { label: "Rejected", color: "badge-red", icon: XCircle },
};

export function RoleBadge({ role }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.visitor;
  const Icon = config.icon;

  return (
    <span className={`badge ${config.color}`}>
      <Icon size={14} />
      {config.label}
    </span>
  );
}

export function ApprovalStatusBadge({ status }) {
  const config = APPROVAL_CONFIG[status] || APPROVAL_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span className={`badge ${config.color}`}>
      <Icon size={14} />
      {config.label}
    </span>
  );
}

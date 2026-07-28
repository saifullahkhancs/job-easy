/**
 * templateDisplay.js — one source of truth for template pickers.
 *
 * Every template dropdown in the app (Send, View, Update) shows the same two
 * things, separated by a little breathing room:
 *
 *     software_engineer   ·   Default · Owned by you
 *     └── role type            └── ownership / type
 *
 * Ownership labels
 *   - "Owned by you"          → a template you authored
 *   - "Default"               → a platform default authored by someone else
 *   - "Default · Owned by you"→ your template, promoted to a platform default
 *   - "User"                  → another user's template (admins only)
 *
 * Ordering
 *   1. the current user's templates
 *   2. default templates
 *   3. other users' templates
 *
 * The backend sends `ownership_label` / `display_group` with each template and
 * this module mirrors that logic, so lists built from other endpoints (or from
 * cached data) still render identically.
 */

export const TEMPLATE_LABELS = {
  OWNED_BY_YOU: "Owned by you",
  DEFAULT: "Default",
  DEFAULT_OWNED_BY_YOU: "Default · Owned by you",
  OTHER_USER: "User",
};

export const TEMPLATE_GROUPS = {
  MINE: 0,
  DEFAULT: 1,
  OTHER_USER: 2,
};

/**
 * Separator used inside <option> text. Regular spaces collapse in HTML, so the
 * non-breaking spaces are what actually create the gap the design asks for.
 */
export const OPTION_SEPARATOR = "\u00a0\u00a0·\u00a0\u00a0";

const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

/** True when `template` was authored by `user` (works for promoted defaults). */
export function isOwnedByUser(template, user) {
  const owner = normalizeEmail(template?.user_email);
  const viewer = normalizeEmail(user?.email);
  if (!owner || !viewer) return false;
  return owner === viewer;
}

export function isDefaultTemplate(template) {
  return String(template?.template_scope || "").toLowerCase() === "default";
}

/** Ownership/type label shown in the dropdown. */
export function getTemplateOwnershipLabel(template, user) {
  // Prefer the label the API computed for this exact viewer.
  if (template?.ownership_label) return template.ownership_label;

  // `is_mine` is the server's ownership flag; fall back to an e-mail match so
  // lists coming from endpoints that omit it still label correctly.
  const mine = Boolean(template?.is_mine) || isOwnedByUser(template, user);
  if (isDefaultTemplate(template)) {
    return mine ? TEMPLATE_LABELS.DEFAULT_OWNED_BY_YOU : TEMPLATE_LABELS.DEFAULT;
  }
  return mine ? TEMPLATE_LABELS.OWNED_BY_YOU : TEMPLATE_LABELS.OTHER_USER;
}

/** Display group used for ordering: 0 = mine, 1 = default, 2 = other users. */
export function getTemplateDisplayGroup(template, user) {
  if (Number.isInteger(template?.display_group)) return template.display_group;

  const mine = Boolean(template?.is_mine) || isOwnedByUser(template, user);
  if (mine) return TEMPLATE_GROUPS.MINE;
  if (isDefaultTemplate(template)) return TEMPLATE_GROUPS.DEFAULT;
  return TEMPLATE_GROUPS.OTHER_USER;
}

/**
 * Order templates for a picker: mine → defaults → other users', then by title
 * and id so the list never shuffles between renders.
 */
export function sortTemplatesForDisplay(templates, user) {
  return [...(templates || [])].sort((a, b) => {
    const groupDiff = getTemplateDisplayGroup(a, user) - getTemplateDisplayGroup(b, user);
    if (groupDiff !== 0) return groupDiff;

    const titleDiff = String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
      sensitivity: "base",
    });
    if (titleDiff !== 0) return titleDiff;

    return Number(a?.id || 0) - Number(b?.id || 0);
  });
}

/**
 * Text for one <option>: "<role type>   ·   <ownership/type>".
 *
 * Admins can see several users' templates at once and role types are only
 * unique per user, so their own view appends the owner's e-mail to keep
 * otherwise identical entries apart.
 */
export function getTemplateOptionLabel(template, user) {
  const roleType = template?.template_role || template?.title || "Template";
  const ownership = getTemplateOwnershipLabel(template, user);

  const parts = [roleType, ownership];
  const isAdminViewer = user?.role === "admin";
  if (isAdminViewer && ownership === TEMPLATE_LABELS.OTHER_USER && template?.user_email) {
    parts.push(template.user_email);
  }

  return parts.join(OPTION_SEPARATOR);
}

/**
 * Who is allowed to send an email with this template.
 * Mirrors the backend rule in `api/v1/email.py`: admins may use any template,
 * everyone else only the ones they authored (promoted defaults included).
 */
export function canSendWithTemplate(template, user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "customer") return false;
  return Boolean(template?.is_mine) || isOwnedByUser(template, user);
}

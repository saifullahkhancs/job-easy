/**
 * Legal documents registry.
 *
 * Each entry is consumed by <LegalPage> which turns `sections` into the
 * numbered article plus its table of contents, so the markdown-ish JSX in the
 * content files stays the single source of truth for both pages.
 */
import { termsDoc } from "./termsContent";
import { privacyDoc } from "./privacyContent";

export const LEGAL_DOCS = [termsDoc, privacyDoc];

export const LEGAL_DOCS_BY_KEY = LEGAL_DOCS.reduce((acc, doc) => {
  acc[doc.key] = doc;
  return acc;
}, {});

export function getLegalDoc(key) {
  return LEGAL_DOCS_BY_KEY[key] || null;
}

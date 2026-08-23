/**
 * Company name <-> URL slug.
 *
 * The slug is what lives in the address bar (`/analyze/apple-inc`), so it has
 * to be lowercase, punctuation-free and stable. It is deliberately lossy —
 * "Apple Inc." and "Apple Inc" collapse to the same slug — which is why the
 * name the visitor actually typed is carried alongside it in router state and
 * `fromSlug` is only the fallback for a refreshed or shared link.
 */

export function toSlug(name) {
  return String(name ?? '')
    // Decompose accents so "Nestlé" becomes "nestle" rather than "nestl".
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function fromSlug(slug) {
  return String(slug ?? '')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

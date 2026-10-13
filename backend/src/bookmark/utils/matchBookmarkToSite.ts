import { SITE_MATCHERS } from '../constants/site-matchers';
import { isMatchingDomain } from './isMatchingDomain';

export function matchBookmarkToSite(
  url: string,
): { site: string; slug: string } | null {
  try {
    const parsed = new URL(url);

    // Only fetch HTTPS URLs from supported sites.
    if (parsed.protocol !== 'https:') {
      return null;
    }

    const hostname = parsed.hostname.replace(/^www\./, '');

    for (const [domain, extractSlug] of Object.entries(SITE_MATCHERS)) {
      if (!isMatchingDomain(hostname, domain)) {
        continue;
      }

      const slug = extractSlug(url);

      if (slug) {
        return { site: domain, slug };
      }
    }
  } catch {
    return null;
  }

  return null;
}

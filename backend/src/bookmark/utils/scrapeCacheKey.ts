export function scrapeCacheKey(site: string, slug: string): string {
  return `scrape:${site}:${slug}`;
}

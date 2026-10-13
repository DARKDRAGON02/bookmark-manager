import pLimit from 'p-limit';
import { SiteLimiter } from '../type/main.type';
import { SCRAPE_CONCURRENCY_PER_SITE } from '../constants/data-map';

export function createSiteLimiter(): SiteLimiter {
  const limiters = new Map<string, ReturnType<typeof pLimit>>();

  return (site: string) => {
    let limiter = limiters.get(site);

    if (!limiter) {
      limiter = pLimit(SCRAPE_CONCURRENCY_PER_SITE);
      limiters.set(site, limiter);
    }

    return limiter;
  };
}

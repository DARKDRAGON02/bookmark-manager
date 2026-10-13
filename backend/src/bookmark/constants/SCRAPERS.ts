import { scrapeAsuraScans } from '../scraper/asurascans';
import { scrapeKingOfShojo } from '../scraper/kingofshojo';
import { scrapeWeebCentral } from '../scraper/weebCentral';
import { Scraper } from '../type/main.type';

export const SCRAPERS: Record<string, Scraper> = {
  'asurascans.com': scrapeAsuraScans,
  'kingofshojo.com': scrapeKingOfShojo,
  'weebcentral.com': scrapeWeebCentral,
};

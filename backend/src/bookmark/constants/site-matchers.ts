export const SITE_MATCHERS: Record<
  string,
  (url: string) => string | undefined
> = {
  'asurascans.com': (url) => url.match(/\/comics\/([^/?]+)/)?.[1],

  'kingofshojo.com': (url) => url.match(/\/manga\/([^/?]+)/)?.[1],

  'weebcentral.com': (url) => {
    const match = url.match(
      /^https:\/\/(?:www\.)?weebcentral\.com\/series\/([^/?#]+)/i,
    );
    return match?.[1];
  },

  'templetoons.com': (url) => {
    const match = url.match(
      /^https:\/\/(?:www\.)?templetoons\.com\/comic\/([^/?#]+)/i,
    );
    return match?.[1];
  },
};

export const SITE_MATCHERS: Record<
  string,
  (url: string) => string | undefined
> = {
  'asurascans.com': (url) => url.match(/\/comics\/([^/?]+)/)?.[1],
  'kingofshojo.com': (url) => url.match(/\/manga\/([^/?]+)/)?.[1],
  'weebcentral.com': (url: string) => {
    const match = url.match(
      /^https:\/\/(?:www\.)?weebcentral\.com\/series\/([^/?#]+)/i,
    );
    return match?.[1];
  },
};

/**
 * Centralized Affiliate Configuration for ThaiKeto
 *
 * Single source of truth for all affiliate link generation.
 * Uses Amazon Associates program.
 */

export interface AffiliateConfig {
  tag: string;
  marketplace: string;
}

const AFFILIATE_TAG = (() => {
  const tag = 'thaiketo-20'; // FLAG: Confirm this Amazon Associates tag is correct
  if (!tag || tag.trim() === '') {
    throw new Error('Amazon affiliate tag is not set.');
  }
  return tag;
})();

export function getAffiliateConfig(): AffiliateConfig {
  return {
    tag: AFFILIATE_TAG,
    marketplace: 'amazon.com',
  };
}

export function buildAmazonProductUrl(asin: string): string {
  const config = getAffiliateConfig();
  return `https://www.${config.marketplace}/dp/${asin}?tag=${config.tag}`;
}

export function buildAmazonSearchUrl(keywords: string): string {
  const config = getAffiliateConfig();
  const encoded = encodeURIComponent(keywords);
  return `https://www.${config.marketplace}/s?k=${encoded}&tag=${config.tag}`;
}

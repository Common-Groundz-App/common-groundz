import React from 'react';
import { Helmet } from 'react-helmet-async';
import { LEGAL_CONFIG } from '@/config/legalConfig';

const baseUrl = LEGAL_CONFIG.websiteUrl;

const ensureAbsoluteUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  canonical?: string;
  noindex?: boolean;
  type?: string;
}

const DEFAULTS = {
  title: 'Common Groundz — Find Your Common Ground',
  description: 'Discover better choices through shared taste. Real recommendations from your friends, family, and trusted circles.',
  image: `${baseUrl}/og-default.png`,
  siteName: 'Common Groundz',
  twitterSite: '@commongroundzHQ',
};

const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  image,
  url,
  canonical,
  noindex = false,
  type = 'website',
}) => {
  const resolvedTitle = title || DEFAULTS.title;
  const resolvedDescription = description || DEFAULTS.description;
  const resolvedImage = ensureAbsoluteUrl(image) || DEFAULTS.image;

  return (
    <Helmet>
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDescription} />

      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph */}
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:site_name" content={DEFAULTS.siteName} />
      <meta property="og:type" content={type} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={DEFAULTS.twitterSite} />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={resolvedImage} />
    </Helmet>
  );
};

export default SEOHead;

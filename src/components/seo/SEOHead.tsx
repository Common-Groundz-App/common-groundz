import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  canonical?: string;
  noindex?: boolean;
}

const DEFAULTS = {
  title: 'Common Groundz',
  description: 'Discover trusted recommendations on Common Groundz',
  image: '/og-default.png',
  siteName: 'Common Groundz',
  twitterSite: '@commongroundz',
};

const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  image,
  url,
  canonical,
  noindex = false,
}) => {
  const resolvedTitle = title || DEFAULTS.title;
  const resolvedDescription = description || DEFAULTS.description;
  const resolvedImage = image || DEFAULTS.image;

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
      {url && <meta property="og:url" content={url} />}
      <meta property="og:site_name" content={DEFAULTS.siteName} />
      <meta property="og:type" content="profile" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:site" content={DEFAULTS.twitterSite} />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={resolvedImage} />
    </Helmet>
  );
};

export default SEOHead;

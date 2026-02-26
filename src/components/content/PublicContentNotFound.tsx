import React from 'react';
import SEOHead from '@/components/seo/SEOHead';

interface PublicContentNotFoundProps {
  title?: string;
  description?: string;
}

const PublicContentNotFound: React.FC<PublicContentNotFoundProps> = ({
  title = 'Content Not Available',
  description = 'The content you are looking for is no longer available or has been removed.',
}) => {
  return (
    <>
      <SEOHead noindex={true} title={title} />
      <div className="flex-1 flex items-center justify-center py-20 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
    </>
  );
};

export default PublicContentNotFound;

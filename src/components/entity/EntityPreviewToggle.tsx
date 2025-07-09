
import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, ArrowLeft, ArrowRight, Copy, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const EntityPreviewToggle = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const isPreviewMode = searchParams.get('preview') === 'true' || searchParams.get('v') === '2';
  const isV3 = window.location.pathname.includes('/v3');
  
  const togglePreview = () => {
    if (isV3) {
      // From V3 to original
      navigate(`/entity/${slug}`);
    } else if (isPreviewMode) {
      // From V2 to original
      navigate(`/entity/${slug}`);
    } else {
      // From original to V2
      navigate(`/entity/${slug}?preview=true`);
    }
  };
  
  const goToV3 = () => {
    navigate(`/entity/${slug}/v3`);
  };
  
  const copyCurrentUrl = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl);
    toast({
      title: "URL copied",
      description: "The current page URL has been copied to your clipboard"
    });
  };
  
  const currentVersion = isV3 ? 'V3' : (isPreviewMode ? 'V2' Preview' : 'Original');
  
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
      {/* Main Toggle Button */}
      <Button
        onClick={togglePreview}
        variant={isPreviewMode || isV3 ? "default" : "outline"}
        size="sm"
        className={`${
          isPreviewMode || isV3
            ? 'bg-purple-500 hover:bg-purple-600 text-white' 
            : 'bg-white/90 hover:bg-white border-2 border-blue-200'
        } backdrop-blur-sm shadow-lg`}
      >
        {isPreviewMode || isV3 ? (
          <>
            <EyeOff className="h-4 w-4 mr-2" />
            Exit {isV3 ? 'V3' : 'V2'}
          </>
        ) : (
          <>
            <Eye className="h-4 w-4 mr-2" />
            Try V2
          </>
        )}
      </Button>
      
      {/* V3 Button */}
      {!isV3 && (
        <Button
          onClick={goToV3}
          variant="outline"
          size="sm"
          className="bg-green-500 hover:bg-green-600 text-white backdrop-blur-sm shadow-lg"
        >
          <Settings className="h-4 w-4 mr-2" />
          Try V3
        </Button>
      )}
      
      {/* Copy URL Button */}
      <Button
        onClick={copyCurrentUrl}
        variant="outline"
        size="sm"
        className="bg-white/90 hover:bg-white backdrop-blur-sm shadow-lg"
      >
        <Copy className="h-4 w-4" />
        <span className="sr-only">Copy URL</span>
      </Button>
      
      {/* Status Badge */}
      <Badge 
        variant="outline" 
        className={`${
          isV3
            ? 'bg-green-100/90 text-green-800 border-green-300'
            : isPreviewMode 
              ? 'bg-purple-100/90 text-purple-800 border-purple-300' 
              : 'bg-blue-100/90 text-blue-800 border-blue-300'
        } backdrop-blur-sm text-xs px-2 py-1 justify-center`}
      >
        {currentVersion}
      </Badge>
    </div>
  );
};

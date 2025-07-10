
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
  
  const togglePreview = () => {
    if (isPreviewMode) {
      // Go back to original
      navigate(`/entity/${slug}`);
    } else {
      // Go to preview
      navigate(`/entity/${slug}?preview=true`);
    }
  };
  
  const copyCurrentUrl = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl);
    toast({
      title: "URL copied",
      description: "The current page URL has been copied to your clipboard"
    });
  };
  
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
      {/* Main Toggle Button */}
      <Button
        onClick={togglePreview}
        variant={isPreviewMode ? "default" : "outline"}
        size="sm"
        className={`${
          isPreviewMode 
            ? 'bg-purple-500 hover:bg-purple-600 text-white' 
            : 'bg-white/90 hover:bg-white border-2 border-blue-200'
        } backdrop-blur-sm shadow-lg`}
      >
        {isPreviewMode ? (
          <>
            <EyeOff className="h-4 w-4 mr-2" />
            Exit V2
          </>
        ) : (
          <>
            <Eye className="h-4 w-4 mr-2" />
            Try V2
          </>
        )}
      </Button>
      
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
          isPreviewMode 
            ? 'bg-purple-100/90 text-purple-800 border-purple-300' 
            : 'bg-blue-100/90 text-blue-800 border-blue-300'
        } backdrop-blur-sm text-xs px-2 py-1 justify-center`}
      >
        {isPreviewMode ? 'V2 Preview' : 'Original'}
      </Badge>
    </div>
  );
};

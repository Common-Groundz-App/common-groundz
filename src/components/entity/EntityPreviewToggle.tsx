
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
  
  const currentVersion = searchParams.get('v') || (searchParams.get('preview') === 'true' ? '2' : '1');
  
  const cycleVersion = () => {
    switch (currentVersion) {
      case '1':
        navigate(`/entity/${slug}?v=2`);
        break;
      case '2':
        navigate(`/entity/${slug}?v=3`);
        break;
      case '3':
        navigate(`/entity/${slug}`);
        break;
      default:
        navigate(`/entity/${slug}?v=2`);
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
        onClick={cycleVersion}
        variant={currentVersion !== '1' ? "default" : "outline"}
        size="sm"
        className={`${
          currentVersion === '1'
            ? 'bg-white/90 hover:bg-white border-2 border-blue-200'
            : currentVersion === '2'
            ? 'bg-purple-500 hover:bg-purple-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        } backdrop-blur-sm shadow-lg`}
      >
        {currentVersion === '1' ? (
          <>
            <Eye className="h-4 w-4 mr-2" />
            Try V2
          </>
        ) : currentVersion === '2' ? (
          <>
            <ArrowRight className="h-4 w-4 mr-2" />
            Try V3
          </>
        ) : (
          <>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to V1
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
          currentVersion === '1'
            ? 'bg-blue-100/90 text-blue-800 border-blue-300'
            : currentVersion === '2'
            ? 'bg-purple-100/90 text-purple-800 border-purple-300'
            : 'bg-green-100/90 text-green-800 border-green-300'
        } backdrop-blur-sm text-xs px-2 py-1 justify-center`}
      >
        {currentVersion === '1' ? 'V1 Original' : currentVersion === '2' ? 'V2 Preview' : 'V3 Beta'}
      </Badge>
    </div>
  );
};

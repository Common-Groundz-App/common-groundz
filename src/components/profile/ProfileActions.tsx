
import React from 'react';
import { Button } from "@/components/ui/button";
import { Save } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ProfileActionsProps {
  hasChanges: boolean;
  isLoading: boolean;
  uploading?: boolean;
  onSaveChanges: () => void;
}

const ProfileActions = ({ 
  hasChanges, 
  isLoading, 
  uploading = false, 
  onSaveChanges 
}: ProfileActionsProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="flex space-x-3 mb-6">
      {hasChanges ? (
        <Button 
          size={isMobile ? "sm" : "default"} 
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={onSaveChanges}
          disabled={!hasChanges || isLoading || uploading}
        >
          <Save size={16} className="mr-1" /> Save Changes
        </Button>
      ) : (
        <>
          <Button size={isMobile ? "sm" : "default"} className="bg-brand-orange hover:bg-brand-orange/90">Follow</Button>
          <Button size={isMobile ? "sm" : "default"} variant="outline">Message</Button>
        </>
      )}
    </div>
  );
};

export default ProfileActions;


import React from 'react';
import { Button } from "@/components/ui/button";
import { Save } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface SaveChangesButtonProps {
  hasChanges: boolean;
  isLoading: boolean;
  uploading?: boolean;
  onSaveChanges: () => void;
}

const SaveChangesButton = ({ 
  hasChanges, 
  isLoading, 
  uploading = false, 
  onSaveChanges 
}: SaveChangesButtonProps) => {
  const isMobile = useIsMobile();
  
  if (!hasChanges) {
    return null;
  }
  
  return (
    <Button 
      size={isMobile ? "sm" : "default"} 
      className="bg-green-600 hover:bg-green-700 text-white"
      onClick={onSaveChanges}
      disabled={isLoading || uploading}
    >
      <Save size={16} className="mr-1" /> Save Changes
    </Button>
  );
};

export default SaveChangesButton;

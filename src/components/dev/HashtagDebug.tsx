import React from 'react';
import { Button } from '@/components/ui/button';
import { repairExistingPostHashtags, repairExistingPostHashtagsLegacy, testHashtagExtraction } from '@/utils/repairHashtags';
import { toast } from 'sonner';

export const HashtagDebug: React.FC = () => {
  const handleRepairHashtags = async () => {
    toast.info('Starting hashtag repair...');
    try {
      await repairExistingPostHashtags();
      toast.success('Hashtag repair completed!');
    } catch (error) {
      console.error('Repair failed:', error);
      toast.error('Hashtag repair failed');
    }
  };

  const handleTestExtraction = () => {
    testHashtagExtraction();
    toast.info('Check console for hashtag extraction test results');
  };

  const handleLegacyRepair = async () => {
    toast.info('Starting legacy hashtag repair...');
    try {
      await repairExistingPostHashtagsLegacy();
      toast.success('Legacy hashtag repair completed!');
    } catch (error) {
      console.error('Legacy repair failed:', error);
      toast.error('Legacy hashtag repair failed');
    }
  };

  return (
    <div className="flex gap-2 p-4 bg-muted rounded-lg">
      <Button onClick={handleTestExtraction} variant="outline" size="sm">
        Test Hashtag Extraction
      </Button>
      <Button onClick={handleRepairHashtags} variant="default" size="sm">
        Repair Hashtags (DB Function)
      </Button>
      <Button onClick={handleLegacyRepair} variant="secondary" size="sm">
        Legacy Repair
      </Button>
    </div>
  );
};
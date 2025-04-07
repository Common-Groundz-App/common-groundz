
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface ProfilePostsEmptyProps {
  isOwnProfile: boolean;
}

const ProfilePostsEmpty = ({ isOwnProfile }: ProfilePostsEmptyProps) => {
  return (
    <Card className="border-dashed">
      <CardContent className="text-center py-12 flex flex-col items-center">
        <div className="mb-4 p-4 bg-muted rounded-full">
          <FileText size={40} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No posts yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          {isOwnProfile ? 'You haven\'t created any posts yet.' : 'This user hasn\'t created any posts yet.'}
        </p>
        {isOwnProfile && (
          <Button 
            size="lg"
            className="px-6 bg-brand-orange hover:bg-brand-orange/90"
            onClick={() => {
              const event = new CustomEvent('open-create-post-dialog');
              window.dispatchEvent(event);
            }}
          >
            Create your first post
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfilePostsEmpty;

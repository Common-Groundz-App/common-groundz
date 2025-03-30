
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

const ProfileAbout = () => {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h2 className="text-lg font-bold">About</h2>
        <p className="text-sm text-muted-foreground">
          Food enthusiast, adventure seeker, and bookworm. Always looking for hidden gems 
          and new experiences to share with my friends.
        </p>
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar size={16} className="mr-2" />
          Joined January 2022
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileAbout;


import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const ProfileStats = () => {
  const stats = [
    { value: 27, label: 'Reviews' },
    { value: 43, label: 'Places' },
    { value: 142, label: 'Followers' },
    { value: 98, label: 'Following' },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileStats;

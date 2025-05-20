
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminLink } from './AdminLink';

export const AdminSection = () => {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Administration</CardTitle>
        <CardDescription>
          Access admin tools and features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AdminLink />
      </CardContent>
    </Card>
  );
};


import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

const FeedEmptyState = () => {
  return (
    <Card className="border-dashed">
      <CardContent className="text-center py-12 flex flex-col items-center">
        <div className="mb-4 p-4 bg-muted rounded-full">
          <Inbox size={40} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No content available</h3>
        <p className="text-muted-foreground max-w-sm">
          We don't have any recommendations to show you right now. Check back soon!
        </p>
      </CardContent>
    </Card>
  );
};

export default FeedEmptyState;

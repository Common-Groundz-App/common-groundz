
import React from 'react';
import { Button } from "@/components/ui/button";
import { MessageSquare } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const MessageButton = () => {
  const isMobile = useIsMobile();
  
  return (
    <Button size={isMobile ? "sm" : "default"} variant="outline">
      <MessageSquare size={16} className="mr-1" /> Message
    </Button>
  );
};

export default MessageButton;

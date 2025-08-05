import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Entity } from '@/services/recommendation/types';
import { EntitySuggestionModal } from './EntitySuggestionModal';

interface EntitySuggestionButtonProps {
  entity: Entity;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const EntitySuggestionButton: React.FC<EntitySuggestionButtonProps> = ({
  entity,
  variant = "outline",
  size = "sm",
  className = "w-full"
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to suggest edits to entities",
        variant: "destructive"
      });
      return;
    }

    setIsModalOpen(true);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
      >
        Suggest an Edit
      </Button>

      <EntitySuggestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entity={entity}
      />
    </>
  );
};
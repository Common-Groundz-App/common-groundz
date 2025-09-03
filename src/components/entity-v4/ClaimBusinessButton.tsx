import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Award } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Entity } from '@/services/recommendation/types';
import { ClaimBusinessModal } from './ClaimBusinessModal';

interface ClaimBusinessButtonProps {
  entity: Entity;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary" | "gradient";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const ClaimBusinessButton: React.FC<ClaimBusinessButtonProps> = ({
  entity,
  variant = "gradient",
  size = "sm",
  className = "w-full gap-2"
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to claim this business",
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
        <Award className="w-4 h-4" />
        Claim This Business
      </Button>

      <ClaimBusinessModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entity={entity}
      />
    </>
  );
};
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useEmailVerification } from '@/hooks/useEmailVerification';

interface CreatePostButtonProps {
  onPostCreated?: () => void;
}

export function CreatePostButton({ onPostCreated }: CreatePostButtonProps) {
  const navigate = useNavigate();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();

  const handleButtonClick = () => {
    if (!canPerformAction('canCreatePosts')) {
      showVerificationRequired('canCreatePosts');
      return;
    }
    navigate('/create');
  };

  return (
    <Button
      onClick={handleButtonClick}
      className="bg-brand-orange hover:bg-brand-orange/90 gap-2"
    >
      <PlusCircle size={18} />
      Share Experience
    </Button>
  );
}

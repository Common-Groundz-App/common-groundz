
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const AdminLink = () => {
  const { user } = useAuth();
  
  // Basic admin check - only show for users with email ending in @lovable.dev
  const isAdmin = user?.email?.endsWith('@lovable.dev');
  
  if (!isAdmin) {
    return null;
  }
  
  return (
    <div className="py-2">
      <Link to="/admin">
        <Button variant="outline" className="w-full justify-start">
          <ShieldCheck className="mr-2 h-4 w-4" />
          Admin Dashboard
        </Button>
      </Link>
      <p className="text-xs text-muted-foreground mt-2">
        Access advanced administration features
      </p>
    </div>
  );
};

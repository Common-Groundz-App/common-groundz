import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resolveUsername } from '@/services/usernameRedirectService';
import { Loader2 } from 'lucide-react';

const UserProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [notFoundUsername, setNotFoundUsername] = useState<string>('');

  useEffect(() => {
    const resolve = async () => {
      if (!username) {
        setNotFound(true);
        setNotFoundUsername('');
        setIsLoading(false);
        return;
      }
      
      const result = await resolveUsername(username);
      
      if (result.notFound) {
        setNotFound(true);
        setNotFoundUsername(username);
        setIsLoading(false);
        return;
      }
      
      if (result.wasRedirected) {
        if (result.currentUsername) {
          navigate(`/u/${result.currentUsername}`, { replace: true });
        } else {
          navigate(`/profile/${result.userId}`, { replace: true });
        }
        return;
      }
      
      navigate(`/profile/${result.userId}`, { replace: true });
    };
    
    resolve();
  }, [username, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-foreground">User not found</h1>
          <p className="text-muted-foreground">
            The username @{notFoundUsername} doesn't exist.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default UserProfile;

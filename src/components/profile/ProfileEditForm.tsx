
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateUsernameFormat, checkUsernameUniqueness, checkUsernameNotHistorical } from '@/utils/usernameValidation';
import { useAuth } from '@/contexts/AuthContext';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { useDebouncedCallback } from 'use-debounce';
import { useProfileCacheActions } from '@/hooks/use-profile-cache';
import { AtSign, Lock, AlertTriangle } from 'lucide-react';
import { calculateUsernameCooldown } from '@/utils/usernameCooldown';

interface ProfileEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  bio: string;
  location: string;
  firstName: string;
  lastName: string;
  onProfileUpdate: (username: string, bio: string, location: string, firstName: string, lastName: string) => void;
  usernameChangedAt: string | null;
}

interface FormValues {
  username: string;
  bio: string;
  location: string;
  firstName: string;
  lastName: string;
}

const ProfileEditForm = ({ 
  isOpen, 
  onClose, 
  username, 
  bio, 
  location, 
  firstName, 
  lastName, 
  onProfileUpdate,
  usernameChangedAt
}: ProfileEditFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isVerified } = useEmailVerification();
  const { invalidateProfile } = useProfileCacheActions();
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [initialUsername, setInitialUsername] = useState('');

  const cooldownState = calculateUsernameCooldown(usernameChangedAt);
  // Username is locked if in cooldown OR not email verified
  const isUsernameLocked = cooldownState.isLocked || !isVerified;

  const form = useForm<FormValues>({
    defaultValues: {
      username: username || '',
      bio: bio || '',
      location: location || '',
      firstName: firstName || '',
      lastName: lastName || ''
    }
  });

  // Reset form values when props change or dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        username: username || '',
        bio: bio || '',
        location: location || '',
        firstName: firstName || '',
        lastName: lastName || ''
      });
      setInitialUsername(username);
      setUsernameError('');
    }
  }, [isOpen, username, bio, location, firstName, lastName, form]);

  // Clear username error when locked (prevents blocking other edits)
  useEffect(() => {
    if (isUsernameLocked) {
      setUsernameError('');
    }
  }, [isUsernameLocked]);

  // Debounced uniqueness and historical check (400ms delay)
  const debouncedCheckAvailability = useDebouncedCallback(
    async (value: string) => {
      if (value.length >= 3 && value !== initialUsername) {
        setIsCheckingUsername(true);
        
        // Check historical first
        const { isAvailable, error: historyError } = await checkUsernameNotHistorical(value);
        if (!isAvailable) {
          setUsernameError(historyError);
          setIsCheckingUsername(false);
          return;
        }
        
        // Then check uniqueness
        const { isUnique, error: uniqueError } = await checkUsernameUniqueness(value);
        if (!isUnique) {
          setUsernameError(uniqueError);
        } else {
          setUsernameError('');
        }
        setIsCheckingUsername(false);
      }
    },
    400
  );

  const handleUsernameChange = (value: string) => {
    const newValue = value.toLowerCase();
    
    if (newValue !== initialUsername) {
      const formatError = validateUsernameFormat(newValue);
      setUsernameError(formatError);
      
      if (!formatError && newValue.length >= 3) {
        debouncedCheckAvailability(newValue);
      }
    } else {
      setUsernameError('');
    }
  };

  const onSubmit = async (data: FormValues) => {
    // Ensure username is lowercase
    data.username = data.username.toLowerCase();
    
    // Only check username error if not locked
    if (!isUsernameLocked && usernameError) {
      toast({
        title: 'Invalid username',
        description: usernameError,
        variant: 'destructive'
      });
      return;
    }

    if (!isUsernameLocked && isCheckingUsername) {
      toast({
        title: 'Please wait',
        description: 'Checking username availability...'
      });
      return;
    }

    try {
      if (!user) throw new Error('User not authenticated');
      
      // Build update object - exclude username if locked
      const profileUpdate: { bio: string; location: string; username?: string } = {
        bio: data.bio,
        location: data.location
      };
      
      // Only include username if not locked
      if (!isUsernameLocked) {
        profileUpdate.username = data.username;
      }
      
      // Update profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileError) throw profileError;
      
      // Update user metadata for first/last name
      const { error: userError } = await supabase.auth.updateUser({
        data: {
          first_name: data.firstName,
          last_name: data.lastName
        }
      });

      if (userError) throw userError;

      // Update local state - use original username if locked
      const updatedUsername = isUsernameLocked ? username : data.username;
      onProfileUpdate(updatedUsername, data.bio, data.location, data.firstName, data.lastName);
      
      // Invalidate the profile cache so useViewedProfile gets fresh data
      if (user?.id) {
        invalidateProfile(user.id);
      }
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.'
      });
      
      // Refresh the UserMenu and other listeners with userId for targeted invalidation
      window.dispatchEvent(new CustomEvent('profile-updated', { 
        detail: { userId: user.id } 
      }));
      
      onClose();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'There was an error updating your profile',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="First Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Last Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    {isUsernameLocked ? (
                      // LOCKED STATE
                      <>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            value={field.value}
                            disabled
                            className="pl-10 bg-muted cursor-not-allowed"
                          />
                        </div>
                      </>
                    ) : (
                      // EDITABLE STATE
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="username" 
                          {...field} 
                          value={field.value.toLowerCase()}
                          onChange={(e) => {
                            const lowercaseValue = e.target.value.toLowerCase();
                            field.onChange(lowercaseValue);
                            handleUsernameChange(lowercaseValue);
                          }}
                          className={`pl-10 ${usernameError ? 'border-red-500' : ''}`}
                        />
                      </div>
                    )}
                  </FormControl>
                  
                  {isUsernameLocked ? (
                    <>
                      {cooldownState.isLocked ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Username changes available: {cooldownState.formattedNextChangeDate}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          Verify your email to change your username.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      {usernameError && (
                        <p className="text-red-500 text-xs mt-1">{usernameError}</p>
                      )}
                      {isCheckingUsername && (
                        <p className="text-muted-foreground text-xs mt-1">Checking username availability...</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        3-20 characters. Letters, numbers, dots, and underscores only. Cannot start or end with dots/underscores.
                      </p>
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        You can only change your username once every 30 days. Your old username will be permanently retired.
                      </p>
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Where are you located?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell us about yourself" 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button 
                type="submit" 
                disabled={(!!usernameError && !isUsernameLocked) || isCheckingUsername}
              >
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditForm;

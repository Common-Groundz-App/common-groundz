
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validateUsernameFormat, checkUsernameUniqueness } from '@/utils/usernameValidation';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileUpdates {
  username?: string;
  bio?: string;
  location?: string;
  firstName?: string;
  lastName?: string;
}

interface ProfileEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  bio: string;
  location: string;
  firstName: string;
  lastName: string;
  onProfileUpdate: (updates: ProfileUpdates) => void;
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
  onProfileUpdate 
}: ProfileEditFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [initialUsername, setInitialUsername] = useState('');

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

  const handleUsernameChange = async (value: string) => {
    // Force lowercase
    const newValue = value.toLowerCase();
    
    // Only validate if username has changed from initial value
    if (newValue !== initialUsername) {
      const formatError = validateUsernameFormat(newValue);
      setUsernameError(formatError);
      
      if (!formatError && newValue.length >= 3) {
        setIsCheckingUsername(true);
        const { isUnique, error } = await checkUsernameUniqueness(newValue);
        if (!isUnique) {
          setUsernameError(error);
        } else {
          setUsernameError('');
        }
        setIsCheckingUsername(false);
      }
    } else {
      setUsernameError('');
    }
  };

  const onSubmit = async (data: FormValues) => {
    // Ensure username is lowercase
    data.username = data.username.toLowerCase();
    
    if (usernameError) {
      toast({
        title: 'Invalid username',
        description: usernameError,
        variant: 'destructive'
      });
      return;
    }

    if (isCheckingUsername) {
      toast({
        title: 'Please wait',
        description: 'Checking username availability...'
      });
      return;
    }

    try {
      if (!user) throw new Error('User not authenticated');
      
      // Update profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username: data.username,
          bio: data.bio,
          location: data.location
        })
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

      // Update local state
      onProfileUpdate({
        username: data.username,
        bio: data.bio,
        location: data.location,
        firstName: data.firstName,
        lastName: data.lastName
      });
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.'
      });
      
      // Refresh the UserMenu
      window.dispatchEvent(new CustomEvent('profile-updated'));
      
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
                    <Input 
                      placeholder="Username" 
                      {...field} 
                      value={field.value.toLowerCase()}
                      onChange={(e) => {
                        const lowercaseValue = e.target.value.toLowerCase();
                        field.onChange(lowercaseValue);
                        handleUsernameChange(lowercaseValue);
                      }}
                      className={usernameError ? 'border-red-500' : ''}
                    />
                  </FormControl>
                  {usernameError && (
                    <p className="text-red-500 text-xs mt-1">{usernameError}</p>
                  )}
                  {isCheckingUsername && (
                    <p className="text-gray-500 text-xs mt-1">Checking username availability...</p>
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
              <Button type="submit" disabled={!!usernameError || isCheckingUsername}>Save changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditForm;

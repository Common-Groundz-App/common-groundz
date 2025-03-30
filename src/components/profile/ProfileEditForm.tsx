
import React from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfileEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  bio: string;
  onProfileUpdate: (username: string, bio: string) => void;
}

interface FormValues {
  username: string;
  bio: string;
}

const ProfileEditForm = ({ isOpen, onClose, username, bio, onProfileUpdate }: ProfileEditFormProps) => {
  const { toast } = useToast();
  const form = useForm<FormValues>({
    defaultValues: {
      username: username || '',
      bio: bio || ''
    }
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: data.username,
          bio: data.bio
        })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        throw error;
      }

      onProfileUpdate(data.username, data.bio);
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.'
      });
      
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Update failed',
        description: 'There was an error updating your profile.',
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
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Username" {...field} />
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
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditForm;

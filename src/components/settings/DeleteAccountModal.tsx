 import React, { useState } from 'react';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { useToast } from '@/hooks/use-toast';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { AlertTriangle } from 'lucide-react';
 import { ACCOUNT_RECOVERY_POLICY } from '@/config/authConfig';
 
 interface DeleteAccountModalProps {
   isOpen: boolean;
   onClose: () => void;
 }
 
 const DeleteAccountModal = ({ isOpen, onClose }: DeleteAccountModalProps) => {
   const { signOut } = useAuth();
   const { toast } = useToast();
   const [confirmText, setConfirmText] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState('');
 
   const isConfirmed = confirmText === 'DELETE';
 
   const handleDelete = async () => {
     if (!isConfirmed) return;
     
     setIsLoading(true);
     setError('');
     
     try {
       const { data: sessionData } = await supabase.auth.getSession();
       
       if (!sessionData.session) {
         throw new Error('No active session');
       }
       
       const response = await supabase.functions.invoke('deactivate-account', {
         headers: {
           Authorization: `Bearer ${sessionData.session.access_token}`,
         },
       });
       
       if (response.error) {
         throw response.error;
       }
       
       if (response.data?.error) {
         if (response.data.code === 'ALREADY_DELETED') {
           // Account already deleted, just sign out
           await signOut();
           return;
         }
         throw new Error(response.data.error);
       }
       
       toast({
         title: 'Account deleted',
         description: 'Your account has been successfully deleted.',
       });
       
       // Sign out is handled by the edge function, but we also call it here
       // to update local state immediately
       await signOut();
     } catch (err: any) {
       console.error('Error deleting account:', err);
       setError(err.message || 'Failed to delete account');
       toast({
         title: 'Error',
         description: err.message || 'Failed to delete account',
         variant: 'destructive',
       });
     } finally {
       setIsLoading(false);
     }
   };
 
   const handleClose = () => {
     setConfirmText('');
     setError('');
     onClose();
   };
 
   return (
     <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
       <DialogContent className="sm:max-w-[425px]">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2 text-destructive">
             <AlertTriangle className="h-5 w-5" />
             Delete Account
           </DialogTitle>
           <DialogDescription>
             This action cannot be easily undone. All your data will be marked for deletion.
           </DialogDescription>
         </DialogHeader>
         
         <div className="space-y-4">
           <div className="bg-muted/50 rounded-lg p-4 text-sm">
             <h4 className="font-medium mb-2">What happens when you delete your account:</h4>
             <ul className="list-disc list-inside space-y-1 text-muted-foreground">
               <li>You will be immediately signed out of all devices</li>
               <li>Your profile will no longer be visible to others</li>
               <li>Your data will be retained for {ACCOUNT_RECOVERY_POLICY.windowDays} days</li>
               <li>Contact support to recover within the recovery window</li>
             </ul>
           </div>
           
           <div className="space-y-2">
             <Label htmlFor="confirm-delete">
               Type <span className="font-mono font-bold">DELETE</span> to confirm
             </Label>
             <Input
               id="confirm-delete"
               value={confirmText}
               onChange={(e) => setConfirmText(e.target.value)}
               placeholder="Type DELETE to confirm"
               className={confirmText && !isConfirmed ? 'border-destructive' : ''}
             />
           </div>
           
           {error && (
             <p className="text-sm text-destructive">{error}</p>
           )}
         </div>
         
         <DialogFooter>
           <Button type="button" variant="outline" onClick={handleClose}>
             Cancel
           </Button>
           <Button
             variant="destructive"
             onClick={handleDelete}
             disabled={!isConfirmed || isLoading}
           >
             {isLoading ? 'Deleting...' : 'Delete Account'}
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default DeleteAccountModal;
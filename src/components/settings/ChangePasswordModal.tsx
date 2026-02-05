 import React, { useState } from 'react';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { useToast } from '@/hooks/use-toast';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { EyeIcon, EyeOffIcon, KeyIcon } from 'lucide-react';
 import { calculatePasswordStrength } from '@/utils/passwordStrength';
 
 interface ChangePasswordModalProps {
   isOpen: boolean;
   onClose: () => void;
 }
 
 const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
   const { user } = useAuth();
   const { toast } = useToast();
   const [currentPassword, setCurrentPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [showCurrentPassword, setShowCurrentPassword] = useState(false);
   const [showNewPassword, setShowNewPassword] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState('');
 
   const passwordStrength = calculatePasswordStrength(newPassword);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     setError('');
     
     if (!currentPassword || !newPassword || !confirmPassword) {
       setError('All fields are required');
       return;
     }
     
     if (newPassword !== confirmPassword) {
       setError('New passwords do not match');
       return;
     }
     
     if (!passwordStrength.meetsMinimum) {
       setError('Please choose a stronger password');
       return;
     }
     
     setIsLoading(true);
     
     try {
       // Verify current password by attempting sign in
       const { error: signInError } = await supabase.auth.signInWithPassword({
         email: user?.email || '',
         password: currentPassword,
       });
       
       if (signInError) {
         setError('Current password is incorrect');
         setIsLoading(false);
         return;
       }
       
       // Update password
       const { error: updateError } = await supabase.auth.updateUser({
         password: newPassword,
       });
       
       if (updateError) {
         throw updateError;
       }
       
       toast({
         title: 'Password updated',
         description: 'Your password has been successfully changed.',
       });
       
       handleClose();
     } catch (err: any) {
       console.error('Error changing password:', err);
       setError(err.message || 'Failed to change password');
     } finally {
       setIsLoading(false);
     }
   };
 
   const handleClose = () => {
     setCurrentPassword('');
     setNewPassword('');
     setConfirmPassword('');
     setError('');
     onClose();
   };
 
   return (
     <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
       <DialogContent className="sm:max-w-[425px]">
         <DialogHeader>
           <DialogTitle>Change Password</DialogTitle>
           <DialogDescription>
             Enter your current password and choose a new one.
           </DialogDescription>
         </DialogHeader>
         
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="current-password">Current Password</Label>
             <div className="relative">
               <KeyIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                 id="current-password"
                 type={showCurrentPassword ? 'text' : 'password'}
                 value={currentPassword}
                 onChange={(e) => setCurrentPassword(e.target.value)}
                 className="pl-10 pr-10"
                 placeholder="Enter current password"
               />
               <button
                 type="button"
                 onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
               >
                 {showCurrentPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
               </button>
             </div>
           </div>
           
           <div className="space-y-2">
             <Label htmlFor="new-password">New Password</Label>
             <div className="relative">
               <KeyIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                 id="new-password"
                 type={showNewPassword ? 'text' : 'password'}
                 value={newPassword}
                 onChange={(e) => setNewPassword(e.target.value)}
                 className="pl-10 pr-10"
                 placeholder="Enter new password"
               />
               <button
                 type="button"
                 onClick={() => setShowNewPassword(!showNewPassword)}
                 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
               >
                 {showNewPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
               </button>
             </div>
             {newPassword && (
               <div className="space-y-1">
                 <div className="flex gap-1">
                   {[1, 2, 3, 4].map((level) => (
                     <div
                       key={level}
                       className={`h-1 flex-1 rounded ${
                         level <= passwordStrength.score
                           ? passwordStrength.score <= 1 ? 'bg-destructive'
                             : passwordStrength.score <= 2 ? 'bg-orange-500'
                             : passwordStrength.score <= 3 ? 'bg-yellow-500'
                             : 'bg-green-500'
                           : 'bg-muted'
                       }`}
                     />
                   ))}
                 </div>
                 <p className="text-xs text-muted-foreground">{passwordStrength.feedback}</p>
               </div>
             )}
           </div>
           
           <div className="space-y-2">
             <Label htmlFor="confirm-password">Confirm New Password</Label>
             <Input
               id="confirm-password"
               type="password"
               value={confirmPassword}
               onChange={(e) => setConfirmPassword(e.target.value)}
               placeholder="Confirm new password"
             />
           </div>
           
           {error && (
             <p className="text-sm text-destructive">{error}</p>
           )}
           
           <DialogFooter>
             <Button type="button" variant="outline" onClick={handleClose}>
               Cancel
             </Button>
             <Button type="submit" disabled={isLoading}>
               {isLoading ? 'Updating...' : 'Update Password'}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 };
 
 export default ChangePasswordModal;
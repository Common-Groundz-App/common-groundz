 import React from 'react';
 import { Link } from 'react-router-dom';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import Logo from '@/components/Logo';
 import { ACCOUNT_RECOVERY_POLICY } from '@/config/authConfig';
 import { Mail, UserPlus } from 'lucide-react';
 
 const AccountDeleted = () => {
   return (
     <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
       <div className="mb-8">
         <Logo size="lg" />
       </div>
       
       <Card className="w-full max-w-md">
         <CardHeader className="text-center">
           <CardTitle className="text-2xl">Account Deleted</CardTitle>
           <CardDescription>
             Your account has been successfully deleted.
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-6">
           <div className="bg-muted/50 rounded-lg p-4 text-sm">
             <h3 className="font-medium mb-2">Need to recover your account?</h3>
             <p className="text-muted-foreground mb-2">
               {ACCOUNT_RECOVERY_POLICY.description}
             </p>
             <p className="text-muted-foreground">
               Contact us at:{' '}
               <a 
                 href={`mailto:${ACCOUNT_RECOVERY_POLICY.supportEmail}`}
                 className="text-primary hover:underline"
               >
                 {ACCOUNT_RECOVERY_POLICY.supportEmail}
               </a>
             </p>
           </div>
           
           <div className="flex flex-col gap-3">
             <Button asChild className="w-full gap-2">
               <Link to="/auth">
                 <UserPlus className="h-4 w-4" />
                 Create a new account
               </Link>
             </Button>
             
             <Button asChild variant="outline" className="w-full gap-2">
               <a href={`mailto:${ACCOUNT_RECOVERY_POLICY.supportEmail}?subject=Account Recovery Request`}>
                 <Mail className="h-4 w-4" />
                 Contact Support
               </a>
             </Button>
           </div>
         </CardContent>
       </Card>
     </div>
   );
 };
 
 export default AccountDeleted;
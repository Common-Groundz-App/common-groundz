
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { User, UserCircle } from 'lucide-react';

interface UserInfoFieldsProps {
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
}

const UserInfoFields = ({ firstName, setFirstName, lastName, setLastName }: UserInfoFieldsProps) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="space-y-2 flex-1">
        <Label htmlFor="signup-firstname">First Name</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            id="signup-firstname" 
            placeholder="John" 
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            maxLength={50}
            className="pl-10"
          />
        </div>
      </div>
      <div className="space-y-2 flex-1">
        <Label htmlFor="signup-lastname">Last Name</Label>
        <div className="relative">
          <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            id="signup-lastname" 
            placeholder="Doe" 
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            maxLength={50}
            className="pl-10"
          />
        </div>
      </div>
    </div>
  );
};

export default UserInfoFields;

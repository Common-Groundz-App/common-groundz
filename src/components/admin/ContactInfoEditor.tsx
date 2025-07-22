import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Phone, Mail, Globe, MapPin } from 'lucide-react';

interface ContactInfo {
  emails?: string[];
  phones?: string[];
  website?: string;
  address?: string;
  social_media?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
}

interface ContactInfoEditorProps {
  value: ContactInfo;
  onChange: (contact: ContactInfo) => void;
  disabled?: boolean;
}

export const ContactInfoEditor: React.FC<ContactInfoEditorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const addEmail = () => {
    const emails = value.emails || [];
    onChange({
      ...value,
      emails: [...emails, '']
    });
  };

  const updateEmail = (index: number, email: string) => {
    const emails = value.emails || [];
    const newEmails = [...emails];
    newEmails[index] = email;
    onChange({
      ...value,
      emails: newEmails.filter(e => e.trim() !== '')
    });
  };

  const removeEmail = (index: number) => {
    const emails = value.emails || [];
    const newEmails = emails.filter((_, i) => i !== index);
    onChange({
      ...value,
      emails: newEmails
    });
  };

  const addPhone = () => {
    const phones = value.phones || [];
    onChange({
      ...value,
      phones: [...phones, '']
    });
  };

  const updatePhone = (index: number, phone: string) => {
    const phones = value.phones || [];
    const newPhones = [...phones];
    newPhones[index] = phone;
    onChange({
      ...value,
      phones: newPhones.filter(p => p.trim() !== '')
    });
  };

  const removePhone = (index: number) => {
    const phones = value.phones || [];
    const newPhones = phones.filter((_, i) => i !== index);
    onChange({
      ...value,
      phones: newPhones
    });
  };

  const updateSocialMedia = (platform: string, url: string) => {
    const social = value.social_media || {};
    onChange({
      ...value,
      social_media: {
        ...social,
        [platform]: url.trim() || undefined
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Contact Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Addresses */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Addresses
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addEmail}
              disabled={disabled}
              className="h-8"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Email
            </Button>
          </div>
          {(value.emails || []).map((email, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => updateEmail(index, e.target.value)}
                placeholder="email@example.com"
                disabled={disabled}
                className="text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeEmail(index)}
                disabled={disabled}
                className="h-9 w-9 p-0 flex-shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {(!value.emails || value.emails.length === 0) && (
            <p className="text-xs text-muted-foreground">No email addresses added</p>
          )}
        </div>

        {/* Phone Numbers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Numbers
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPhone}
              disabled={disabled}
              className="h-8"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Phone
            </Button>
          </div>
          {(value.phones || []).map((phone, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="tel"
                value={phone}
                onChange={(e) => updatePhone(index, e.target.value)}
                placeholder="+1 (555) 123-4567"
                disabled={disabled}
                className="text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removePhone(index)}
                disabled={disabled}
                className="h-9 w-9 p-0 flex-shrink-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {(!value.phones || value.phones.length === 0) && (
            <p className="text-xs text-muted-foreground">No phone numbers added</p>
          )}
        </div>

        {/* Website */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Website
          </Label>
          <Input
            type="url"
            value={value.website || ''}
            onChange={(e) => onChange({ ...value, website: e.target.value })}
            placeholder="https://example.com"
            disabled={disabled}
            className="text-sm"
          />
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Address
          </Label>
          <Input
            value={value.address || ''}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            placeholder="123 Main St, City, State, ZIP"
            disabled={disabled}
            className="text-sm"
          />
        </div>

        {/* Social Media */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Social Media</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Facebook</Label>
              <Input
                type="url"
                value={value.social_media?.facebook || ''}
                onChange={(e) => updateSocialMedia('facebook', e.target.value)}
                placeholder="https://facebook.com/..."
                disabled={disabled}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Instagram</Label>
              <Input
                type="url"
                value={value.social_media?.instagram || ''}
                onChange={(e) => updateSocialMedia('instagram', e.target.value)}
                placeholder="https://instagram.com/..."
                disabled={disabled}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Twitter</Label>
              <Input
                type="url"
                value={value.social_media?.twitter || ''}
                onChange={(e) => updateSocialMedia('twitter', e.target.value)}
                placeholder="https://twitter.com/..."
                disabled={disabled}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">LinkedIn</Label>
              <Input
                type="url"
                value={value.social_media?.linkedin || ''}
                onChange={(e) => updateSocialMedia('linkedin', e.target.value)}
                placeholder="https://linkedin.com/..."
                disabled={disabled}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
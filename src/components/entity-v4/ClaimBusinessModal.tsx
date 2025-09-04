import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, Controller } from "react-hook-form";
import { ChevronLeft, ChevronRight, Building, User, FileText, Phone, Mail, Clock } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MediaUploader } from '@/components/media/MediaUploader';
import { usePersistedForm } from '@/hooks/usePersistedForm';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { supabase } from '@/integrations/supabase/client';

interface ClaimFormData {
  ownerName: string;
  ownerTitle: string;
  ownerEmail: string;
  ownerPhone: string;
  ownershipDuration: string;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  businessWebsite: string;
  hours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  verificationDocuments: MediaItem[];
  claimContext: string;
  contactPreferences: string;
}

interface ClaimBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Entity;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const ClaimBusinessModal: React.FC<ClaimBusinessModalProps> = ({
  isOpen,
  onClose,
  entity
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialFormData: ClaimFormData = {
    ownerName: '',
    ownerTitle: '',
    ownerEmail: user?.email || '',
    ownerPhone: '',
    ownershipDuration: '',
    businessName: entity.name || '',
    businessPhone: entity.metadata?.phone || '',
    businessEmail: '',
    businessAddress: entity.metadata?.formatted_address || entity.venue || '',
    businessWebsite: entity.website_url || '',
    hours: {
      monday: entity.metadata?.hours?.monday || '',
      tuesday: entity.metadata?.hours?.tuesday || '',
      wednesday: entity.metadata?.hours?.wednesday || '',
      thursday: entity.metadata?.hours?.thursday || '',
      friday: entity.metadata?.hours?.friday || '',
      saturday: entity.metadata?.hours?.saturday || '',
      sunday: entity.metadata?.hours?.sunday || ''
    },
    verificationDocuments: [],
    claimContext: '',
    contactPreferences: 'email'
  };

  const {
    formData,
    updateField,
    clearPersistedData
  } = usePersistedForm(`claim-business-${entity.id}`, initialFormData);

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<ClaimFormData>({
    defaultValues: formData
  });

  const watchedFields = watch();

  // Sync form state with persisted data
  useEffect(() => {
    if (isOpen) {
      Object.keys(watchedFields).forEach(key => {
        updateField(key as keyof ClaimFormData, watchedFields[key as keyof ClaimFormData]);
      });
    }
  }, [watchedFields, updateField, isOpen]);

  const handleMediaUploaded = (media: MediaItem) => {
    updateField('verificationDocuments', [...formData.verificationDocuments, media]);
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: ClaimFormData) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to claim this business",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Prepare claim data with owner information and business updates
      const suggestedChanges: any = {
        owner_name: data.ownerName,
        owner_title: data.ownerTitle,
        owner_email: data.ownerEmail,
        owner_phone: data.ownerPhone,
        ownership_duration: data.ownershipDuration,
        contact_preferences: data.contactPreferences
      };

      // Include business updates if different from current
      if (data.businessName !== entity.name) suggestedChanges.name = data.businessName;
      if (data.businessPhone !== entity.metadata?.phone) suggestedChanges.phone = data.businessPhone;
      if (data.businessEmail) suggestedChanges.email = data.businessEmail;
      if (data.businessAddress !== (entity.metadata?.formatted_address || entity.venue)) suggestedChanges.address = data.businessAddress;
      if (data.businessWebsite !== entity.website_url) suggestedChanges.website = data.businessWebsite;
      
      // Include hours if there are changes
      const hasHourChanges = DAYS.some(day => 
        data.hours[day as keyof typeof data.hours] !== (entity.metadata?.hours?.[day] || '')
      );
      if (hasHourChanges) {
        suggestedChanges.hours = data.hours;
      }

      const { error } = await supabase
        .from('entity_suggestions')
        .insert({
          entity_id: entity.id,
          user_id: user.id,
          suggested_changes: suggestedChanges,
          suggested_images: formData.verificationDocuments.map(doc => ({
            url: doc.url,
            type: doc.type,
            caption: doc.caption
          })),
          user_is_owner: true, // This is a claim
          context: data.claimContext,
          priority_score: 95 // High priority for claims
        });

      if (error) throw error;

      toast({
        title: "Business claim submitted",
        description: "Your claim has been submitted for review. Our team will contact you within 3-5 business days to verify ownership."
      });

      clearPersistedData();
      setCurrentStep(1);
      onClose();
    } catch (error) {
      console.error('Error submitting claim:', error);
      toast({
        title: "Claim submission failed",
        description: "There was an error submitting your claim. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-5 h-5" />
        <h3 className="text-lg font-medium">Owner Information</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ownerName">Full Name *</Label>
          <Input
            id="ownerName"
            {...register('ownerName', { required: 'Name is required' })}
            placeholder="Your full name"
          />
          {errors.ownerName && (
            <p className="text-destructive text-sm">{errors.ownerName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerTitle">Title/Position</Label>
          <Input
            id="ownerTitle"
            {...register('ownerTitle')}
            placeholder="Owner, Manager, CEO, etc."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ownerEmail">Email Address *</Label>
          <Input
            id="ownerEmail"
            type="email"
            {...register('ownerEmail', { required: 'Email is required' })}
            placeholder="your@email.com"
          />
          {errors.ownerEmail && (
            <p className="text-destructive text-sm">{errors.ownerEmail.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerPhone">Phone Number *</Label>
          <Input
            id="ownerPhone"
            {...register('ownerPhone', { required: 'Phone number is required' })}
            placeholder="Your phone number"
          />
          {errors.ownerPhone && (
            <p className="text-destructive text-sm">{errors.ownerPhone.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownershipDuration">How long have you owned/managed this business? *</Label>
        <Input
          id="ownershipDuration"
          {...register('ownershipDuration', { required: 'This field is required' })}
          placeholder="e.g., 2 years, Since 2020, etc."
        />
        {errors.ownershipDuration && (
          <p className="text-destructive text-sm">{errors.ownershipDuration.message}</p>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Building className="w-5 h-5" />
        <h3 className="text-lg font-medium">Business Information</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name</Label>
          <Input
            id="businessName"
            {...register('businessName')}
            placeholder="Business name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessPhone">Business Phone</Label>
          <Input
            id="businessPhone"
            {...register('businessPhone')}
            placeholder="Business phone number"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="businessEmail">Business Email</Label>
          <Input
            id="businessEmail"
            type="email"
            {...register('businessEmail')}
            placeholder="business@email.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessWebsite">Website</Label>
          <Input
            id="businessWebsite"
            {...register('businessWebsite')}
            placeholder="https://yourbusiness.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessAddress">Address</Label>
        <Input
          id="businessAddress"
          {...register('businessAddress')}
          placeholder="Business address"
        />
      </div>

      <div className="space-y-4 mt-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          <h4 className="text-md font-medium">Business Hours (Optional)</h4>
        </div>
        
        {DAYS.map(day => (
          <div key={day} className="flex items-center gap-4">
            <div className="w-24 text-sm font-medium capitalize">{day}</div>
            <Controller
              name={`hours.${day}` as any}
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="e.g., 9:00 AM - 5:00 PM or Closed"
                  className="flex-1"
                />
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5" />
        <h3 className="text-lg font-medium">Verification Documents</h3>
      </div>
      
      <div className="bg-muted/50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Please upload documents that prove your ownership:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Business license or registration</li>
          <li>• Tax documents or EIN certificate</li>
          <li>• Utility bills in business name</li>
          <li>• Lease agreement or property deed</li>
          <li>• Bank statements or business checks</li>
          <li>• Any other official business documents</li>
        </ul>
      </div>

      <MediaUploader
        sessionId={`claim-${entity.id}`}
        onMediaUploaded={handleMediaUploaded}
        initialMedia={formData.verificationDocuments}
        maxMediaCount={10}
      />
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Final Details</h3>
        
        <div className="space-y-2">
          <Label htmlFor="claimContext">Why are you claiming this business? *</Label>
          <Textarea
            id="claimContext"
            {...register('claimContext', { required: 'Please explain why you are claiming this business' })}
            placeholder="Tell us why you're claiming this business and provide any additional context that might help verify your ownership..."
            rows={4}
          />
          {errors.claimContext && (
            <p className="text-destructive text-sm">{errors.claimContext.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactPreferences">Preferred contact method for verification</Label>
          <Controller
            name="contactPreferences"
            control={control}
            render={({ field }) => (
              <select {...field} className="w-full p-2 border rounded">
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="both">Both email and phone</option>
              </select>
            )}
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>1. Our team will review your claim and documents (3-5 business days)</p>
            <p>2. We may contact you to verify ownership details</p>
            <p>3. Once approved, you'll have control over your business listing</p>
            <p>4. You can then update information, respond to reviews, and more</p>
          </div>
        </div>
      </div>
    </div>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Owner Information";
      case 2: return "Business Details";
      case 3: return "Verification Documents";
      case 4: return "Final Details";
      default: return "Claim Business";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Claim {entity.name}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Step {currentStep} of 4:</span>
            <span>{getStepTitle()}</span>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{getStepTitle()}</CardTitle>
            </CardHeader>
            <CardContent>
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
            </CardContent>
          </Card>

          <div className="flex justify-between mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="gradient"
                >
                  {isSubmitting ? "Submitting Claim..." : "Submit Claim"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
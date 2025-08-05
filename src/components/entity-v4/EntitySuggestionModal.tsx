import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, Controller } from "react-hook-form";
import { Clock, MapPin, Phone, Globe, ChevronLeft, ChevronRight, AlertCircle, Building, User } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MediaUploader } from '@/components/media/MediaUploader';
import { usePersistedForm } from '@/hooks/usePersistedForm';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { supabase } from '@/integrations/supabase/client';

interface SuggestionFormData {
  name: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  hours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  isBusinessClosed: boolean;
  isBusinessMoved: boolean;
  isDuplicate: boolean;
  duplicateEntityId: string;
  context: string;
  userIsOwner: boolean;
  suggestedImages: MediaItem[];
}

interface EntitySuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Entity;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const EntitySuggestionModal: React.FC<EntitySuggestionModalProps> = ({
  isOpen,
  onClose,
  entity
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialFormData: SuggestionFormData = {
    name: entity.name || '',
    description: entity.description || '',
    address: entity.metadata?.formatted_address || entity.venue || '',
    phone: entity.metadata?.phone || '',
    website: entity.website_url || '',
    hours: {
      monday: entity.metadata?.hours?.monday || '',
      tuesday: entity.metadata?.hours?.tuesday || '',
      wednesday: entity.metadata?.hours?.wednesday || '',
      thursday: entity.metadata?.hours?.thursday || '',
      friday: entity.metadata?.hours?.friday || '',
      saturday: entity.metadata?.hours?.saturday || '',
      sunday: entity.metadata?.hours?.sunday || ''
    },
    isBusinessClosed: false,
    isBusinessMoved: false,
    isDuplicate: false,
    duplicateEntityId: '',
    context: '',
    userIsOwner: false,
    suggestedImages: []
  };

  const {
    formData,
    updateField,
    clearPersistedData
  } = usePersistedForm(`entity-suggestion-${entity.id}`, initialFormData);

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<SuggestionFormData>({
    defaultValues: formData
  });

  const watchedFields = watch();

  // Sync form state with persisted data
  useEffect(() => {
    if (isOpen) {
      Object.keys(watchedFields).forEach(key => {
        updateField(key as keyof SuggestionFormData, watchedFields[key as keyof SuggestionFormData]);
      });
    }
  }, [watchedFields, updateField, isOpen]);

  const isBusinessEntity = ['place', 'food'].includes(entity.type);

  const handleMediaUploaded = (media: MediaItem) => {
    updateField('suggestedImages', [...formData.suggestedImages, media]);
  };

  const handleNext = () => {
    setCurrentStep(prev => {
      const nextStep = prev + 1;
      // Skip step 2 (business hours) for non-business entities
      if (nextStep === 2 && !isBusinessEntity) {
        return 3;
      }
      return Math.min(nextStep, 4);
    });
  };

  const handlePrevious = () => {
    setCurrentStep(prev => {
      const prevStep = prev - 1;
      // Skip step 2 (business hours) for non-business entities
      if (prevStep === 2 && !isBusinessEntity) {
        return 1;
      }
      return Math.max(prevStep, 1);
    });
  };

  const onSubmit = async (data: SuggestionFormData) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to suggest edits",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Prepare suggested changes
      const suggestedChanges: any = {};
      
      if (data.name !== entity.name) suggestedChanges.name = data.name;
      if (data.description !== entity.description) suggestedChanges.description = data.description;
      if (data.address !== (entity.metadata?.formatted_address || entity.venue)) suggestedChanges.address = data.address;
      if (data.phone !== entity.metadata?.phone) suggestedChanges.phone = data.phone;
      if (data.website !== entity.website_url) suggestedChanges.website = data.website;
      
      // Only include hours for business entities
      if (isBusinessEntity) {
        const hasHourChanges = DAYS.some(day => 
          data.hours[day as keyof typeof data.hours] !== (entity.metadata?.hours?.[day] || '')
        );
        if (hasHourChanges) {
          suggestedChanges.hours = data.hours;
        }
      }

      const { error } = await supabase
        .from('entity_suggestions')
        .insert({
          entity_id: entity.id,
          user_id: user.id,
          suggested_changes: suggestedChanges,
          suggested_images: data.suggestedImages.map(img => ({
            url: img.url,
            type: img.type,
            caption: img.caption
          })),
          is_business_closed: data.isBusinessClosed,
          is_duplicate: data.isDuplicate,
          duplicate_of_entity_id: data.duplicateEntityId || null,
          user_is_owner: data.userIsOwner,
          context: data.context
        });

      if (error) throw error;

      toast({
        title: "Suggestion submitted",
        description: "Thank you for helping improve our database! We'll review your suggestion soon."
      });

      clearPersistedData();
      setCurrentStep(1);
      onClose();
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast({
        title: "Submission failed",
        description: "There was an error submitting your suggestion. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="Entity name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            {...register('address')}
            placeholder="Street address"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Describe this entity"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            {...register('phone')}
            placeholder="Phone number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            {...register('website')}
            placeholder="Website URL"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5" />
          <h3 className="text-lg font-medium">Business Hours</h3>
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
    );
  };

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Special Status
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Controller
              name="isBusinessClosed"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="closed"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="closed">This business is permanently closed or has moved</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Controller
              name="isDuplicate"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="duplicate"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label htmlFor="duplicate">This is a duplicate of another entity</Label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Suggested Images</h3>
        <MediaUploader
          sessionId={`suggestion-${entity.id}`}
          onMediaUploaded={handleMediaUploaded}
          initialMedia={formData.suggestedImages}
          maxMediaCount={5}
        />
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Additional Information</h3>
        
        <div className="space-y-2">
          <Label htmlFor="context">Please explain your suggested changes *</Label>
          <Textarea
            id="context"
            {...register('context', { required: 'Please explain your changes' })}
            placeholder="Help us understand why these changes are needed..."
            rows={4}
          />
          {errors.context && (
            <p className="text-destructive text-sm">{errors.context.message}</p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Controller
            name="userIsOwner"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="owner"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label htmlFor="owner">I am the owner/manager of this business</Label>
        </div>
      </div>
    </div>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return "Basic Information";
      case 2: return "Business Hours";
      case 3: return "Status & Images";
      case 4: return "Context & Verification";
      default: return "Suggest an Edit";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Suggest an Edit for {entity.name}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Step {currentStep} of {isBusinessEntity ? 4 : 3}:</span>
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
                >
                  {isSubmitting ? "Submitting..." : "Submit Suggestion"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
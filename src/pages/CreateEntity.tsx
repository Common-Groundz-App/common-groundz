import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { EntityTypeSelector } from '@/components/create-entity/EntityTypeSelector';
import { BrandSelector } from '@/components/create-entity/BrandSelector';
import { CategorySelector } from '@/components/create-entity/CategorySelector';
import { EntityDetailsForm } from '@/components/create-entity/EntityDetailsForm';
import { EntityPreview } from '@/components/create-entity/EntityPreview';
import { usePersistedForm } from '@/hooks/usePersistedForm';
import { EntityType } from '@/services/recommendation/types';
import { useOptimisticEntityCreation } from '@/hooks/use-optimistic-entity-creation';
import { useToast } from '@/hooks/use-toast';

export interface CreateEntityFormData {
  entityType: EntityType | null;
  name: string;
  description: string;
  categoryId: string;
  parentEntityId: string;
  parentEntityName: string;
  websiteUrl: string;
  imageFile: File | null;
  imageUrl: string;
  venue: string;
  // Type-specific fields
  typeSpecificData: Record<string, any>;
}

const initialFormData: CreateEntityFormData = {
  entityType: null,
  name: '',
  description: '',
  categoryId: '',
  parentEntityId: '',
  parentEntityName: '',
  websiteUrl: '',
  imageFile: null,
  imageUrl: '',
  venue: '',
  typeSpecificData: {}
};

const STEPS = [
  { id: 1, title: 'Type', description: 'Choose entity type' },
  { id: 2, title: 'Brand', description: 'Select parent/brand' },
  { id: 3, title: 'Category', description: 'Pick category' },
  { id: 4, title: 'Details', description: 'Add information' },
  { id: 5, title: 'Review', description: 'Confirm & submit' }
];

export default function CreateEntity() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { formData, updateField, resetForm } = usePersistedForm<CreateEntityFormData>(
    'create-entity-form',
    initialFormData
  );
  
  const { createEntityOptimistically, isCreating, creationProgress } = useOptimisticEntityCreation({
    entityType: formData.entityType || EntityType.Product,
    onEntityCreated: (entity) => {
      resetForm();
      toast({
        title: 'Entity created successfully',
        description: `${entity.name} has been added to the platform`
      });
    }
  });

  // Pre-populate from search params
  React.useEffect(() => {
    const query = searchParams.get('q');
    const type = searchParams.get('type') as EntityType;
    
    if (query && formData.name === '') {
      updateField('name', query);
    }
    if (type && formData.entityType === null) {
      updateField('entityType', type);
    }
  }, [searchParams, formData.name, formData.entityType, updateField]);

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1: return formData.entityType !== null;
      case 2: return true; // Optional step
      case 3: return formData.categoryId !== '';
      case 4: return formData.name.trim() !== '' && formData.description.trim() !== '';
      case 5: return true;
      default: return false;
    }
  };

  const canProceed = isStepValid(currentStep);
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === STEPS.length;

  const handleNext = () => {
    if (canProceed && !isLastStep) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formData.entityType || !formData.name || !formData.description) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const externalData = {
        name: formData.name,
        description: formData.description,
        venue: formData.venue,
        image_url: formData.imageUrl,
        website_url: formData.websiteUrl,
        imageFile: formData.imageFile, // Include the image file for upload
        metadata: {
          user_created: true,
          category_id: formData.categoryId,
          parent_id: formData.parentEntityId,
          ...formData.typeSpecificData
        }
      };

      await createEntityOptimistically(externalData);
    } catch (error) {
      console.error('Entity creation failed:', error);
      toast({
        title: 'Creation failed',
        description: 'Could not create entity. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <EntityTypeSelector
            selectedType={formData.entityType}
            onTypeSelect={(type) => updateField('entityType', type)}
          />
        );
      case 2:
        return (
          <BrandSelector
            entityType={formData.entityType!}
            selectedBrandId={formData.parentEntityId || ''}
            selectedBrandName={formData.parentEntityName || ''}
            onBrandSelect={(brandId, brandName) => {
              console.log('Brand selected in parent:', brandId, brandName);
              updateField('parentEntityId', brandId || undefined);
              updateField('parentEntityName', brandName || undefined);
            }}
            onSkip={() => {
              console.log('Skip button clicked - clearing selection');
              updateField('parentEntityId', undefined);
              updateField('parentEntityName', undefined);
            }}
          />
        );
      case 3:
        return (
          <CategorySelector
            entityType={formData.entityType!}
            selectedCategoryId={formData.categoryId}
            onCategorySelect={(categoryId) => updateField('categoryId', categoryId)}
          />
        );
      case 4:
        return (
          <EntityDetailsForm
            formData={formData}
            onFieldUpdate={updateField}
          />
        );
      case 5:
        return (
          <EntityPreview
            formData={formData}
            onEdit={(step) => setCurrentStep(step)}
          />
        );
      default:
        return null;
    }
  };

  const progressPercentage = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  return (
    <>
      <NavBarComponent />
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate(-1)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Create New Entity</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a new {formData.entityType?.toLowerCase() || 'item'} to the platform
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-3">
              <Progress value={progressPercentage} className="w-full" />
              <div className="flex justify-between text-xs text-muted-foreground">
                {STEPS.map((step, index) => (
                  <div 
                    key={step.id}
                    className={`flex flex-col items-center ${
                      currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 ${
                      currentStep > step.id 
                        ? 'bg-primary text-primary-foreground' 
                        : currentStep === step.id 
                        ? 'bg-primary/20 text-primary border-2 border-primary' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {currentStep > step.id ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <span className="hidden sm:block">{step.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step Content */}
          <Card>
            <CardContent className="p-6">
              {isCreating && creationProgress > 0 && (
                <div className="mb-6 p-4 bg-primary/10 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">Creating entity...</p>
                      <Progress value={creationProgress} className="w-full mt-2" />
                    </div>
                  </div>
                </div>
              )}
              
              {renderStepContent()}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep || isSubmitting || isCreating}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              Step {currentStep} of {STEPS.length}
            </div>

            {isLastStep ? (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed || isSubmitting || isCreating}
                className="min-w-[120px]"
              >
                {isSubmitting || isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Entity
                    <CheckCircle className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed || isSubmitting || isCreating}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
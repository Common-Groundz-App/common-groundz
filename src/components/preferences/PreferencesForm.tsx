import React, { useState, useEffect } from 'react';
import { usePreferences } from '@/contexts/PreferencesContext';
import SelectablePills from './SelectablePills';
import TagInput from './TagInput';
import { Button } from '@/components/ui/button';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { useToast } from '@/hooks/use-toast';

// Define the step interface
interface Step {
  title: string;
  description: string;
  emoji: string;
  component: React.ReactNode;
}

interface PreferencesFormProps {
  initialPreferences?: any;
  onSaveSuccess?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
}

// Define conflict groups for mutually exclusive options
const CONFLICT_GROUPS = {
  skin_consistency: ['normal', 'dry', 'oily', 'combination'],
  hair_type: ['straight', 'wavy', 'curly', 'frizzy'],
  diet_type: ['vegetarian', 'vegan', 'non-vegetarian']
};

// Define suggested goals for the pills component - MOVED UP HERE to prevent the reference error
const goalOptions = [
  { label: "Improve sleep", value: "Improve sleep", emoji: "😴" },
  { label: "Improve skin", value: "Improve skin", emoji: "✨" },
  { label: "Build muscle", value: "Build muscle", emoji: "💪" },
  { label: "Lose fat", value: "Lose fat", emoji: "🏃" },
  { label: "Read more", value: "Read more", emoji: "📚" },
  { label: "Reduce screen time", value: "Reduce screen time", emoji: "📵" },
  { label: "Wake up early", value: "Wake up early", emoji: "🌅" },
  { label: "Drink more water", value: "Drink more water", emoji: "💧" },
  { label: "Write daily", value: "Write daily", emoji: "✍️" },
  { label: "Reduce anxiety", value: "Reduce anxiety", emoji: "🧘" }
];

const PreferencesForm: React.FC<PreferencesFormProps> = ({
  initialPreferences = {},
  onSaveSuccess,
  onCancel,
  isModal = false
}) => {
  const { updatePreferences } = usePreferences();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    skin_type: initialPreferences.skin_type || [],
    other_skin_type: initialPreferences.other_skin_type || [],
    hair_type: initialPreferences.hair_type || [],
    other_hair_type: initialPreferences.other_hair_type || [],
    food_preferences: initialPreferences.food_preferences || [],
    other_food_preferences: initialPreferences.other_food_preferences || [],
    lifestyle: initialPreferences.lifestyle || [],
    other_lifestyle: initialPreferences.other_lifestyle || [],
    genre_preferences: initialPreferences.genre_preferences || [],
    other_genre_preferences: initialPreferences.other_genre_preferences || [],
    goals: initialPreferences.goals ? initialPreferences.goals.filter(goal => 
      goalOptions.some(option => option.value === goal)
    ) : [],
    other_goals: initialPreferences.goals ? initialPreferences.goals.filter(goal => 
      !goalOptions.some(option => option.value === goal)
    ) : [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset form error when step changes
  useEffect(() => {
    setFormError(null);
  }, [currentStep]);

  const updateFormData = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setFormError(null);
    
    try {
      // Declare variables before using them - Fixed order to prevent ReferenceError
      const goals = formData.goals || [];
      const other_goals = formData.other_goals || [];
      
      // Combine goals and other_goals back into a single array for saving
      const combinedGoals = [...goals, ...other_goals];
      
      // Create a new object instead of modifying the original
      const dataToSubmit = {
        ...formData,
        goals: combinedGoals
      };
      
      // Remove the other_goals field as it's not needed in the final data
      delete dataToSubmit.other_goals;
      
      await updatePreferences(dataToSubmit);
      toast({
        title: "Preferences saved",
        description: "Your preferences have been updated successfully."
      });
      if (onSaveSuccess) {
        onSaveSuccess();
      }
    } catch (error) {
      console.error('Error submitting preferences:', error);
      setFormError('Failed to save preferences. Please try again.');
      toast({
        title: "Error saving preferences",
        description: "There was a problem saving your preferences. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const canProceed = () => {
    switch(currentStep) {
      case 0: // Skin Type
        return formData.skin_type.length > 0 || formData.other_skin_type.length > 0;
      case 1: // Hair Type
        return formData.hair_type.length > 0 || formData.other_hair_type.length > 0;
      case 2: // Food Preferences
        if (formData.food_preferences.includes('other') && formData.other_food_preferences.length === 0) {
          return false; // Can't proceed if "other" is selected but no custom values added
        }
        return formData.food_preferences.length > 0 || formData.other_food_preferences.length > 0;
      case 3: // Lifestyle
        if (formData.lifestyle.includes('other') && formData.other_lifestyle.length === 0) {
          return false; // Can't proceed if "other" is selected but no custom values added
        }
        return formData.lifestyle.length > 0 || formData.other_lifestyle.length > 0;
      case 4: // Genre Preferences
        if (formData.genre_preferences.includes('other') && formData.other_genre_preferences.length === 0) {
          return false; // Can't proceed if "other" is selected but no custom values added
        }
        return formData.genre_preferences.length > 0 || formData.other_genre_preferences.length > 0;
      case 5: // Goals
        // Check both goals and other_goals arrays
        return formData.goals.length > 0 || formData.other_goals.length > 0;
      default:
        return true;
    }
  };
  
  const handleCancel = () => {
    // Only show confirmation if there are changes to discard
    if (isSubmitting) return; // Don't allow cancelling during submission
    
    setShowExitConfirmation(true);
  };
  
  const handleExitConfirm = () => {
    setShowExitConfirmation(false);
    if (onCancel) {
      setTimeout(() => {
        onCancel();
      }, 0);
    }
  };
  
  // Define the step components
  const steps: Step[] = [
    {
      title: "Skin Type",
      description: "Tell us about your skin to get personalized product recommendations.",
      emoji: "🧴",
      component: (
        <SelectablePills
          options={[
            { label: "Dry", value: "dry", emoji: "🏜️" },
            { label: "Oily", value: "oily", emoji: "💦" },
            { label: "Combination", value: "combination", emoji: "🔄" },
            { label: "Sensitive", value: "sensitive", emoji: "🌡️" },
            { label: "Normal", value: "normal", emoji: "✨" }
          ]}
          selectedValues={formData.skin_type}
          onChange={(values) => updateFormData('skin_type', values)}
          allowOther={true}
          otherValues={formData.other_skin_type}
          onOtherChange={(values) => updateFormData('other_skin_type', values)}
          conflictGroups={CONFLICT_GROUPS}
          otherPlaceholder="E.g., Eczema-prone, Acne-prone..."
        />
      )
    },
    {
      title: "Hair Type",
      description: "What's your hair like? We'll suggest products that work for you.",
      emoji: "💇",
      component: (
        <SelectablePills
          options={[
            { label: "Straight", value: "straight", emoji: "➖" },
            { label: "Wavy", value: "wavy", emoji: "〰️" },
            { label: "Curly", value: "curly", emoji: "🌀" },
            { label: "Frizzy", value: "frizzy", emoji: "❇️" },
            { label: "Oily", value: "oily", emoji: "💦" },
            { label: "Dry", value: "dry", emoji: "🏜️" }
          ]}
          selectedValues={formData.hair_type}
          onChange={(values) => updateFormData('hair_type', values)}
          allowOther={true}
          otherValues={formData.other_hair_type}
          onOtherChange={(values) => updateFormData('other_hair_type', values)}
          conflictGroups={CONFLICT_GROUPS}
          otherPlaceholder="E.g., Thin, Color treated..."
        />
      )
    },
    {
      title: "Food Preferences",
      description: "Help us recommend restaurants and recipes you'll love.",
      emoji: "🍱",
      component: (
        <SelectablePills
          options={[
            { label: "Vegetarian", value: "vegetarian", emoji: "🥗" },
            { label: "Vegan", value: "vegan", emoji: "🌱" },
            { label: "Non-Vegetarian", value: "non-vegetarian", emoji: "🍖" },
            { label: "No Onion/Garlic", value: "no-onion-garlic", emoji: "🚫" },
            { label: "Gluten-Free", value: "gluten-free", emoji: "🌾" }
          ]}
          selectedValues={formData.food_preferences}
          onChange={(values) => updateFormData('food_preferences', values)}
          allowOther={true}
          otherValues={formData.other_food_preferences}
          onOtherChange={(values) => updateFormData('other_food_preferences', values)}
          conflictGroups={CONFLICT_GROUPS}
          otherPlaceholder="E.g., Keto, Dairy-free..."
        />
      )
    },
    {
      title: "Lifestyle",
      description: "What's your approach to life? This helps us tailor recommendations.",
      emoji: "🧘",
      component: (
        <SelectablePills
          options={[
            { label: "Minimalist", value: "minimalist", emoji: "🧹" },
            { label: "Active", value: "active", emoji: "🏃" },
            { label: "Busy", value: "busy", emoji: "⏱️" },
            { label: "Tech-Savvy", value: "tech-savvy", emoji: "💻" },
            { label: "Mindful", value: "mindful", emoji: "🧠" }
          ]}
          selectedValues={formData.lifestyle}
          onChange={(values) => updateFormData('lifestyle', values)}
          allowOther={true}
          otherValues={formData.other_lifestyle}
          onOtherChange={(values) => updateFormData('other_lifestyle', values)}
          conflictGroups={CONFLICT_GROUPS}
          otherPlaceholder="E.g., Outdoor enthusiast, Night owl..."
        />
      )
    },
    {
      title: "Genre Preferences",
      description: "What kinds of content do you enjoy?",
      emoji: "🎬",
      component: (
        <SelectablePills
          options={[
            { label: "Action", value: "action", emoji: "💥" },
            { label: "Sci-Fi", value: "sci-fi", emoji: "🚀" },
            { label: "Romcom", value: "romcom", emoji: "❤️" },
            { label: "Thriller", value: "thriller", emoji: "🔪" },
            { label: "Drama", value: "drama", emoji: "🎭" },
            { label: "Anime", value: "anime", emoji: "🗻" }
          ]}
          selectedValues={formData.genre_preferences}
          onChange={(values) => updateFormData('genre_preferences', values)}
          allowOther={true}
          otherValues={formData.other_genre_preferences}
          onOtherChange={(values) => updateFormData('other_genre_preferences', values)}
          conflictGroups={CONFLICT_GROUPS}
          otherPlaceholder="E.g., Documentary, Horror, Fantasy..."
        />
      )
    },
    {
      title: "Goals",
      description: "What are you working towards? Add your personal goals.",
      emoji: "🎯",
      component: (
        <div className="space-y-3">
          <SelectablePills
            options={goalOptions}
            selectedValues={formData.goals}
            onChange={(values) => updateFormData('goals', values)}
            allowOther={true}
            otherValues={formData.other_goals}
            onOtherChange={(values) => updateFormData('other_goals', values)}
            otherPlaceholder="E.g., Learn a new language..."
          />
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {isModal && (
        <div className="flex justify-center mb-6">
          <div className="flex gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-${
                  index === currentStep ? "6" : "2"
                } rounded-full ${
                  index === currentStep
                    ? "bg-brand-orange"
                    : index < currentStep
                    ? "bg-green-500"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <div className="text-4xl mb-2">{steps[currentStep].emoji}</div>
        <h3 className="text-xl font-semibold">{steps[currentStep].title}</h3>
        <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
      </div>

      <div className="my-6">{steps[currentStep].component}</div>

      {formError && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
          {formError}
        </div>
      )}

      <div className="flex justify-between mt-8">
        {currentStep > 0 ? (
          <Button
            variant="outline"
            onClick={() => setCurrentStep(currentStep - 1)}
            className="focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={isSubmitting}
          >
            Back
          </Button>
        ) : (
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        
        {currentStep < steps.length - 1 ? (
          <Button
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={isSubmitting || !canProceed()}
            className="focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canProceed()}
            className="focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            {isSubmitting ? "Saving..." : "Save Preferences"}
          </Button>
        )}
      </div>

      {/* Exit Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showExitConfirmation}
        onClose={() => setShowExitConfirmation(false)}
        onConfirm={handleExitConfirm}
        title="Discard changes?"
        description="You will lose all unsaved changes if you exit now."
        isLoading={false}
      />
    </div>
  );
};

export default PreferencesForm;

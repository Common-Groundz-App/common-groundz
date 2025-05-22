
import React, { useState } from 'react';
import { usePreferences } from '@/contexts/PreferencesContext';
import SelectablePills from './SelectablePills';
import TagInput from './TagInput';
import { Button } from '@/components/ui/button';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';

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

const PreferencesForm: React.FC<PreferencesFormProps> = ({
  initialPreferences = {},
  onSaveSuccess,
  onCancel,
  isModal = false
}) => {
  const { updatePreferences } = usePreferences();
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
    goals: initialPreferences.goals || [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);

  const updateFormData = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await updatePreferences(formData);
      onSaveSuccess?.();
    } catch (error) {
      console.error('Error submitting preferences:', error);
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
        return formData.goals.length > 0;
      default:
        return true;
    }
  };

  // Define suggested goals for the pills component
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
  
  const handleCancel = () => {
    setShowExitConfirmation(true);
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
            selectedValues={formData.goals.filter(goal => 
              goalOptions.some(option => option.value === goal)
            )}
            onChange={(values) => {
              // Keep custom goals and add selected preset goals
              const customGoals = formData.goals.filter(goal => 
                !goalOptions.some(option => option.value === goal)
              );
              updateFormData('goals', [...customGoals, ...values]);
            }}
            allowOther={true}
            otherValues={formData.goals.filter(goal => 
              !goalOptions.some(option => option.value === goal)
            )}
            onOtherChange={(values) => {
              // Preserve preset goals and update custom goals
              const presetGoals = formData.goals.filter(goal => 
                goalOptions.some(option => option.value === goal)
              );
              updateFormData('goals', [...presetGoals, ...values]);
            }}
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

      <div className="flex justify-between mt-8">
        {currentStep > 0 ? (
          <Button
            variant="outline"
            onClick={() => setCurrentStep(currentStep - 1)}
            className="focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            Back
          </Button>
        ) : (
          <Button 
            variant="outline" 
            onClick={handleCancel}
            className="focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            Cancel
          </Button>
        )}
        
        {currentStep < steps.length - 1 ? (
          <Button
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!canProceed()}
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
        onConfirm={() => {
          setShowExitConfirmation(false);
          onCancel?.();
        }}
        title="Discard changes?"
        description="You will lose all unsaved changes if you exit now."
        isLoading={false}
      />
    </div>
  );
};

export default PreferencesForm;

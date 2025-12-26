import React, { useState, useEffect } from 'react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import PreferencesForm from './PreferencesForm';
import ConstraintsSection from './ConstraintsSection';
import LearnedPreferencesSection from './LearnedPreferencesSection';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Ban, Brain, Sparkles, ExternalLink, MoreVertical, Pencil, RotateCcw, Trash2, ChevronDown, X, Plus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConstraintsType, PreferenceCategory, PreferenceValue, UserPreferences, CanonicalCategory } from '@/types/preferences';
import { cn } from '@/lib/utils';
import { countTotalPreferences, getCategoryValues, hasAnyPreferences, createPreferenceValue } from '@/utils/preferenceRouting';
import { arePreferencesEqual, countPreferenceDifferences, isPendingRemoval as checkPendingRemoval, getChangeSummary } from '@/utils/preferenceUtils';
import AddCustomPreferenceModal from './AddCustomPreferenceModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Auto-icon mapping for custom categories
const CUSTOM_CATEGORY_ICONS: Record<string, string> = {
  books: '📚',
  music: '🎵',
  travel: '✈️',
  fitness: '💪',
  cooking: '👨‍🍳',
  technology: '💻',
  movies: '🎬',
  art: '🎨',
  gaming: '🎮',
  sports: '⚽',
  health: '💊',
  fashion: '👗',
  pets: '🐾',
  photography: '📷',
  reading: '📖',
  writing: '✍️',
  education: '🎓',
  finance: '💰',
  nature: '🌿',
  food: '🍽️',
};

const DEFAULT_CATEGORY_ICON = '📌'; // Neutral fallback

// Get icon for a custom category
const getCategoryIcon = (categoryName: string): string => {
  const normalized = categoryName.toLowerCase().trim();
  return CUSTOM_CATEGORY_ICONS[normalized] || DEFAULT_CATEGORY_ICON;
};

// Helper to filter out "other" values (safety net for display)
const filterOtherValues = (values: PreferenceValue[] | undefined): PreferenceValue[] => {
  if (!values) return [];
  return values.filter(v => v.normalizedValue !== 'other');
};

// Helper function to format summary with max items + overflow (with capitalization)
const formatSummary = (items: string[], max = 4): string => {
  if (items.length === 0) return '';
  
  // Capitalize each item
  const capitalizedItems = items.map(item => 
    item.charAt(0).toUpperCase() + item.slice(1)
  );
  
  if (capitalizedItems.length <= max) return capitalizedItems.join(' • ');
  return capitalizedItems.slice(0, max).join(' • ') + ` • +${capitalizedItems.length - max} more`;
};

// Helper component to render preference tags with remove button
const PreferenceChip = ({ 
  pref, 
  field, 
  onRemove,
  isPendingRemoval = false,
  disabled = false
}: { 
  pref: PreferenceValue; 
  field: string; 
  onRemove: (field: string, normalizedValue: string) => void;
  isPendingRemoval?: boolean;
  disabled?: boolean;
}) => (
  <div 
    className={cn(
      "rounded-full py-1 px-3 text-xs flex items-center gap-1 group transition-all duration-200",
      isPendingRemoval && "opacity-40 line-through",
      pref.source === 'chatbot' 
        ? "bg-purple-500/20 text-purple-700 dark:text-purple-300" 
        : "bg-brand-orange/20 text-brand-orange"
    )}
  >
    {pref.value}
    {pref.source === 'chatbot' && (
      <span className="opacity-70 text-[10px]">🤖</span>
    )}
    <button 
      onClick={(e) => {
        e.stopPropagation();
        if (!isPendingRemoval && !disabled) {
          onRemove(field, pref.normalizedValue);
        }
      }}
      disabled={disabled || isPendingRemoval}
      className={cn(
        "opacity-0 group-hover:opacity-100 ml-0.5 hover:text-destructive transition-opacity",
        (disabled || isPendingRemoval) && "cursor-not-allowed opacity-30 group-hover:opacity-30"
      )}
      title={isPendingRemoval ? "Pending removal" : "Remove preference"}
    >
      <X className="h-3 w-3" />
    </button>
  </div>
);

const PreferencesSection = () => {
  const { preferences, updatePreferences, isLoading, learnedPreferences, approveLearnedPreference, dismissLearnedPreference, addPreferenceValue, removePreferenceValue } = usePreferences();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(['preferences']);
  const { toast } = useToast();

  // Confirmation dialog states
  const [resetPreferencesDialogOpen, setResetPreferencesDialogOpen] = useState(false);
  const [clearConstraintsDialogOpen, setClearConstraintsDialogOpen] = useState(false);
  const [clearLearnedDialogOpen, setClearLearnedDialogOpen] = useState(false);

  // Draft-based state for Save/Cancel system
  const [draftPreferences, setDraftPreferences] = useState<UserPreferences>(preferences);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync draft when live preferences change (after save or external update)
  useEffect(() => {
    if (!isEditing) {
      setDraftPreferences(preferences);
    }
  }, [preferences, isEditing]);

  // Derived state using deep equality
  const hasUnsavedChanges = !arePreferencesEqual(draftPreferences, preferences);

  // Count what changed for the save bar
  const { added, removed } = hasUnsavedChanges 
    ? countPreferenceDifferences(preferences, draftPreferences) 
    : { added: 0, removed: 0 };

  // Check if a specific preference is pending removal
  const isPendingRemovalCheck = (field: string, normalizedValue: string) => {
    return checkPendingRemoval(preferences, draftPreferences, field, normalizedValue);
  };

  // Handle removing a preference (modifies draft, not API)
  const handleRemovePreference = (field: string, normalizedValue: string) => {
    if (isSaving) return; // Prevent changes while saving
    
    setIsEditing(true);
    setDraftPreferences(prev => {
      const canonicalFields: CanonicalCategory[] = ['skin_type', 'hair_type', 'food_preferences', 'lifestyle', 'genre_preferences', 'goals'];
      
      if (canonicalFields.includes(field as CanonicalCategory)) {
        const category = prev[field as CanonicalCategory] as PreferenceCategory | undefined;
        if (!category?.values) return prev;
        const updatedValues = category.values.filter(v => v.normalizedValue !== normalizedValue);
        return {
          ...prev,
          [field]: updatedValues.length > 0 ? { values: updatedValues } : undefined
        };
      } else {
        // Custom category
        const customCategories = prev.custom_categories || {};
        const category = customCategories[field];
        if (!category?.values) return prev;
        const updatedValues = category.values.filter(v => v.normalizedValue !== normalizedValue);
        const newCustomCategories = { ...customCategories };
        if (updatedValues.length > 0) {
          newCustomCategories[field] = { values: updatedValues };
        } else {
          delete newCustomCategories[field];
        }
        return {
          ...prev,
          custom_categories: Object.keys(newCustomCategories).length > 0 ? newCustomCategories : undefined
        };
      }
    });
  };

  // Save all pending changes
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const success = await updatePreferences(draftPreferences);
      if (success) {
        setIsEditing(false);
        toast({ title: "Changes saved" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Discard all pending changes
  const handleDiscardChanges = () => {
    setDraftPreferences(preferences);
    setIsEditing(false);
  };

  // Handle adding a new preference from modal
  const handleAddPreference = async (field: CanonicalCategory | string, value: PreferenceValue) => {
    const success = await addPreferenceValue(field, value);
    if (success) {
      toast({
        title: "Preference added",
        description: "Your new preference has been saved."
      });
    }
    setAddModalOpen(false);
  };

  const handleEditClick = () => {
    setEditModalOpen(true);
  };

  const handleSaveSuccess = () => {
    setEditModalOpen(false);
    toast({
      title: "Preferences updated",
      description: "Your personalization preferences have been saved."
    });
  };

  const handleCancel = () => {
    setEditModalOpen(false);
  };

  // Reset only form preferences (KEEP constraints intact)
  const handleResetPreferencesOnly = async () => {
    try {
      await updatePreferences({
        skin_type: undefined,
        hair_type: undefined,
        food_preferences: undefined,
        lifestyle: undefined,
        genre_preferences: undefined,
        goals: undefined,
        custom_categories: undefined,
        constraints: preferences?.constraints, // Preserve constraints!
      });
      toast({
        title: "Preferences reset",
        description: "Your preferences have been cleared. Constraints remain unchanged."
      });
      setResetPreferencesDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not reset preferences. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Clear only constraints (KEEP form preferences intact)
  const handleClearConstraints = async () => {
    try {
      await updatePreferences({
        ...preferences,
        constraints: {
          avoidIngredients: [],
          avoidBrands: [],
          avoidProductForms: [],
          budget: 'no_preference',
          custom: [],
        },
      });
      toast({
        title: "Constraints cleared",
        description: "All constraints have been removed."
      });
      setClearConstraintsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not clear constraints. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Clear all learned preferences
  const handleClearAllLearned = async () => {
    try {
      const activeLearned = learnedPreferences.filter(p => !p.dismissed);
      for (const lp of activeLearned) {
        await dismissLearnedPreference(lp.scope, lp.key);
      }
      toast({
        title: "Learned data cleared",
        description: "All AI-learned preferences have been dismissed."
      });
      setClearLearnedDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not clear learned data. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle constraints update
  const handleUpdateConstraints = async (newConstraints: ConstraintsType) => {
    try {
      await updatePreferences({
        ...preferences,
        constraints: newConstraints
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not update constraints. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleApproveLearned = async (scope: string, key: string, value: any) => {
    // Find the preference to get confidence and evidence
    const pref = learnedPreferences.find(p => p.scope === scope && p.key === key);
    const success = await approveLearnedPreference(scope, key, value, pref?.confidence, pref?.evidence);
    if (success) {
      toast({
        title: "Preference approved",
        description: `"${key}" has been added to your preferences.`
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to approve preference. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDismissLearned = (scope: string, key: string) => {
    dismissLearnedPreference(scope, key);
    toast({
      title: "Preference dismissed",
      description: "This preference won't be suggested again."
    });
  };

  // Count constraints and learned preferences for badges
  const constraints = preferences?.constraints || {};
  const constraintCount = 
    (constraints.avoidIngredients?.length || 0) +
    (constraints.avoidBrands?.length || 0) +
    (constraints.avoidProductForms?.length || 0) +
    (constraints.custom?.length || 0) +
    (constraints.budget && constraints.budget !== 'no_preference' ? 1 : 0);

  const activeLearned = learnedPreferences.filter(p => !p.dismissed);
  const pendingLearnedCount = activeLearned.filter(p => !p.approvedAt).length;

  // Count total preferences for badge (new canonical format)
  const preferencesCount = countTotalPreferences(preferences);

  // Check if each section has content
  const hasFormPreferences = hasAnyPreferences(preferences);
  const hasConstraints = constraintCount > 0;
  const hasLearnedData = activeLearned.length > 0;

  // Generate summary for Your Preferences (excluding "other" values)
  const getPreferencesSummary = (): string => {
    const items: string[] = [];
    
    items.push(...filterOtherValues(preferences?.skin_type?.values).map(v => v.value));
    items.push(...filterOtherValues(preferences?.hair_type?.values).map(v => v.value));
    items.push(...filterOtherValues(preferences?.food_preferences?.values).map(v => v.value));
    items.push(...filterOtherValues(preferences?.lifestyle?.values).map(v => v.value));
    items.push(...filterOtherValues(preferences?.genre_preferences?.values).map(v => v.value));
    
    const goalValues = filterOtherValues(preferences?.goals?.values);
    if (goalValues.length > 0) {
      items.push(`${goalValues.length} goal${goalValues.length > 1 ? 's' : ''}`);
    }
    
    // Add custom categories count (excluding "other")
    if (preferences?.custom_categories) {
      const customCount = Object.values(preferences.custom_categories).reduce(
        (sum, cat) => sum + filterOtherValues(cat?.values).length, 0
      );
      if (customCount > 0) {
        items.push(`${customCount} custom`);
      }
    }
    
    return formatSummary(items) || 'No preferences set';
  };

  // Generate summary for Constraints
  const getConstraintsSummary = (): string => {
    const parts: string[] = [];
    const c = constraints;
    
    if (c.avoidIngredients?.length) parts.push(`${c.avoidIngredients.length} ingredient${c.avoidIngredients.length > 1 ? 's' : ''}`);
    if (c.avoidBrands?.length) parts.push(`${c.avoidBrands.length} brand${c.avoidBrands.length > 1 ? 's' : ''}`);
    if (c.avoidProductForms?.length) parts.push(`${c.avoidProductForms.length} form${c.avoidProductForms.length > 1 ? 's' : ''}`);
    if (c.budget && c.budget !== 'no_preference') parts.push(c.budget);
    if (c.custom?.length) parts.push(`${c.custom.length} custom rule${c.custom.length > 1 ? 's' : ''}`);
    
    return parts.join(' • ') || 'No constraints set';
  };

  // Generate summary for Learned Preferences
  const getLearnedSummary = (): string => {
    const parts: string[] = [];
    if (pendingLearnedCount) parts.push(`${pendingLearnedCount} pending review`);
    return parts.join(' • ') || 'No pending items';
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-accent/30 rounded-md">
        <p className="text-sm text-muted-foreground animate-pulse">Loading preferences...</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Personalization Preferences</CardTitle>
              <CardDescription>
                Customize your product and content recommendations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={["preferences"]} onValueChange={setOpenSections} className="w-full">
            {/* Section 1: Your Preferences */}
            <AccordionItem value="preferences" className="border-b">
              <div className="flex items-center gap-2 group">
                <AccordionTrigger className="flex-1 hover:no-underline py-4 hover:bg-muted/30 rounded-lg px-2 -mx-2 cursor-pointer [&>svg:last-child]:hidden">
                  <div className="flex items-center w-full">
                    <div className="flex flex-col items-start flex-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-orange-500" />
                        <span className="font-medium">Your Preferences</span>
                        {preferencesCount > 0 && (
                          <Badge className="ml-2 text-xs bg-orange-100 text-orange-700">
                            {preferencesCount}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 text-left">
                        {getPreferencesSummary()}
                      </span>
                    </div>
                    
                    {/* Chevron inside trigger - clickable */}
                    <ChevronDown 
                      className={cn(
                        "h-5 w-5 shrink-0 text-muted-foreground/50 transition-all duration-200 mr-2 group-hover:text-muted-foreground/80",
                        openSections.includes('preferences') && "rotate-180"
                      )}
                    />
                  </div>
                </AccordionTrigger>
                
                {/* 3-dots menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background">
                    <DropdownMenuItem onClick={() => setAddModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add preference
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit preferences
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setResetPreferencesDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                      disabled={!hasFormPreferences}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset preferences
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <AccordionContent className="pt-4">
                {hasFormPreferences ? (
                  <div className="space-y-4">
                    {filterOtherValues(preferences.skin_type?.values).length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">🧴 Skin Type</h4>
                        <div className="flex flex-wrap gap-1">
                          {filterOtherValues(preferences.skin_type?.values).map((pref, idx) => (
                            <PreferenceChip 
                              key={`${pref.normalizedValue}-${idx}`} 
                              pref={pref} 
                              field="skin_type" 
                              onRemove={handleRemovePreference}
                              isPendingRemoval={isPendingRemovalCheck("skin_type", pref.normalizedValue)}
                              disabled={isSaving}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {filterOtherValues(preferences.hair_type?.values).length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">💇 Hair Type</h4>
                        <div className="flex flex-wrap gap-1">
                          {filterOtherValues(preferences.hair_type?.values).map((pref, idx) => (
                            <PreferenceChip 
                              key={`${pref.normalizedValue}-${idx}`} 
                              pref={pref} 
                              field="hair_type" 
                              onRemove={handleRemovePreference}
                              isPendingRemoval={isPendingRemovalCheck("hair_type", pref.normalizedValue)}
                              disabled={isSaving}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {filterOtherValues(preferences.food_preferences?.values).length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">🍱 Food Preferences</h4>
                        <div className="flex flex-wrap gap-1">
                          {filterOtherValues(preferences.food_preferences?.values).map((pref, idx) => (
                            <PreferenceChip 
                              key={`${pref.normalizedValue}-${idx}`} 
                              pref={pref} 
                              field="food_preferences" 
                              onRemove={handleRemovePreference}
                              isPendingRemoval={isPendingRemovalCheck("food_preferences", pref.normalizedValue)}
                              disabled={isSaving}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {filterOtherValues(preferences.lifestyle?.values).length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">🧘 Lifestyle</h4>
                        <div className="flex flex-wrap gap-1">
                          {filterOtherValues(preferences.lifestyle?.values).map((pref, idx) => (
                            <PreferenceChip 
                              key={`${pref.normalizedValue}-${idx}`} 
                              pref={pref} 
                              field="lifestyle" 
                              onRemove={handleRemovePreference}
                              isPendingRemoval={isPendingRemovalCheck("lifestyle", pref.normalizedValue)}
                              disabled={isSaving}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {filterOtherValues(preferences.genre_preferences?.values).length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">🎬 Genre Preferences</h4>
                        <div className="flex flex-wrap gap-1">
                          {filterOtherValues(preferences.genre_preferences?.values).map((pref, idx) => (
                            <PreferenceChip 
                              key={`${pref.normalizedValue}-${idx}`} 
                              pref={pref} 
                              field="genre_preferences" 
                              onRemove={handleRemovePreference}
                              isPendingRemoval={isPendingRemovalCheck("genre_preferences", pref.normalizedValue)}
                              disabled={isSaving}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {filterOtherValues(preferences.goals?.values).length > 0 && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">🎯 Goals</h4>
                        <div className="flex flex-wrap gap-1">
                          {filterOtherValues(preferences.goals?.values).map((pref, idx) => (
                            <PreferenceChip 
                              key={`${pref.normalizedValue}-${idx}`} 
                              pref={pref} 
                              field="goals" 
                              onRemove={handleRemovePreference}
                              isPendingRemoval={isPendingRemovalCheck("goals", pref.normalizedValue)}
                              disabled={isSaving}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom Categories */}
                    {preferences.custom_categories && Object.entries(preferences.custom_categories).map(([categoryName, category]) => {
                      const filteredValues = filterOtherValues(category?.values);
                      if (filteredValues.length === 0) return null;
                      return (
                        <div key={categoryName} className="space-y-1">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <span>{getCategoryIcon(categoryName)}</span>
                            {categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {filteredValues.map((pref, idx) => (
                              <PreferenceChip 
                                key={`${pref.normalizedValue}-${idx}`} 
                                pref={pref} 
                                field={categoryName} 
                                onRemove={handleRemovePreference}
                                isPendingRemoval={isPendingRemovalCheck(categoryName, pref.normalizedValue)}
                                disabled={isSaving}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}


                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-3 text-sm">
                      You haven't set any preferences yet.
                    </p>
                    <Button 
                      onClick={handleEditClick} 
                      size="sm"
                      className="focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      Set Your Preferences
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* Section 2: Things to Avoid (Constraints) */}
            <AccordionItem value="constraints" className="border-b">
              <div className="flex items-center gap-2 group">
                <AccordionTrigger className="flex-1 hover:no-underline py-4 hover:bg-muted/30 rounded-lg px-2 -mx-2 cursor-pointer [&>svg:last-child]:hidden">
                  <div className="flex items-center w-full">
                    <div className="flex flex-col items-start flex-1">
                      <div className="flex items-center gap-2">
                        <Ban className="h-5 w-5 text-red-500" />
                        <span className="font-medium">Things to Avoid</span>
                        {constraintCount > 0 && (
                          <Badge className="ml-2 text-xs bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                            {constraintCount}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 text-left">
                        {getConstraintsSummary()}
                      </span>
                    </div>
                    
                    {/* Chevron inside trigger - clickable */}
                    <ChevronDown 
                      className={cn(
                        "h-5 w-5 shrink-0 text-muted-foreground/50 transition-all duration-200 mr-2 group-hover:text-muted-foreground/80",
                        openSections.includes('constraints') && "rotate-180"
                      )}
                    />
                  </div>
                </AccordionTrigger>
                
                {/* 3-dots menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background">
                    <DropdownMenuItem 
                      onClick={() => setClearConstraintsDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                      disabled={!hasConstraints}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear all constraints
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <AccordionContent className="pt-4">
                <ConstraintsSection
                  constraints={constraints}
                  onUpdateConstraints={handleUpdateConstraints}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Section 3: Learned from Conversations */}
            <AccordionItem value="learned" className="border-0">
              <div className="flex items-center gap-2 group">
                <AccordionTrigger className="flex-1 hover:no-underline py-4 hover:bg-muted/30 rounded-lg px-2 -mx-2 cursor-pointer [&>svg:last-child]:hidden">
                  <div className="flex items-center w-full">
                    <div className="flex flex-col items-start flex-1">
                      <div className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">Learned from Conversations</span>
                        {pendingLearnedCount > 0 && (
                          <Badge className="ml-2 text-xs bg-purple-100 text-purple-700">
                            {pendingLearnedCount} pending
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 text-left">
                        {getLearnedSummary()}
                      </span>
                    </div>
                    
                    {/* Chevron inside trigger - clickable */}
                    <ChevronDown 
                      className={cn(
                        "h-5 w-5 shrink-0 text-muted-foreground/50 transition-all duration-200 mr-2 group-hover:text-muted-foreground/80",
                        openSections.includes('learned') && "rotate-180"
                      )}
                    />
                  </div>
                </AccordionTrigger>
                
                {/* 3-dots menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background">
                    <DropdownMenuItem 
                      onClick={() => setClearLearnedDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                      disabled={!hasLearnedData}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear all learned data
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <AccordionContent className="pt-4">
                <LearnedPreferencesSection
                  learnedPreferences={learnedPreferences}
                  onApprove={handleApproveLearned}
                  onDismiss={handleDismissLearned}
                />
                
                <Separator className="my-4" />
                
                <Link 
                  to="/your-data" 
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  View all your data & privacy settings
                </Link>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Floating Save/Cancel Bar */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-background/95 backdrop-blur border rounded-xl shadow-lg p-4 flex items-center gap-4 z-50">
          <span className="text-sm text-muted-foreground">
            {getChangeSummary(added, removed)}
          </span>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDiscardChanges}
              disabled={isSaving}
              className="focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Reset Preferences Confirmation */}
      <AlertDialog open={resetPreferencesDialogOpen} onOpenChange={setResetPreferencesDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Your Preferences?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all preferences you have set (skin type, hair type, food, lifestyle, genres, goals). 
              Your constraints will NOT be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="focus-visible:ring-0 focus-visible:ring-offset-0">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetPreferencesOnly} 
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Reset Preferences
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Constraints Confirmation */}
      <AlertDialog open={clearConstraintsDialogOpen} onOpenChange={setClearConstraintsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Constraints?</AlertDialogTitle>
            <AlertDialogDescription className="text-yellow-600">
              ⚠️ Warning: This will remove ALL ingredients, brands, product forms, budget settings, and custom rules you've added.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="focus-visible:ring-0 focus-visible:ring-offset-0">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearConstraints} 
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Clear All Constraints
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Learned Data Confirmation */}
      <AlertDialog open={clearLearnedDialogOpen} onOpenChange={setClearLearnedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear AI-Learned Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all insights the AI has learned from your conversations.
              You can always rebuild them by chatting more.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="focus-visible:ring-0 focus-visible:ring-offset-0">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleClearAllLearned} 
              className="bg-destructive hover:bg-destructive/90 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Clear Learned Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <PreferencesForm 
            initialPreferences={preferences} 
            onSaveSuccess={handleSaveSuccess} 
            onCancel={handleCancel}
            isModal={true}
          />
        </DialogContent>
      </Dialog>

      {/* Add Preference Modal */}
      <AddCustomPreferenceModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddPreference}
      />
    </>
  );
};

export default PreferencesSection;

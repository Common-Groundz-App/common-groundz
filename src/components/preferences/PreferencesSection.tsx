import React, { useState } from 'react';
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
import { Shield, Brain, Sparkles, ExternalLink, MoreVertical, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConstraintsType, LearnedPreference } from '@/types/preferences';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Helper function to format summary with max items + overflow
const formatSummary = (items: string[], max = 4): string => {
  if (items.length === 0) return '';
  if (items.length <= max) return items.join(' • ');
  return items.slice(0, max).join(' • ') + ` • +${items.length - max} more`;
};

// Helper function to safely render array items as tags
const renderPreferenceTags = (items: any, otherItems?: any) => {
  const safeItems = Array.isArray(items) ? items : (typeof items === 'string' ? [items] : []);
  const safeOtherItems = Array.isArray(otherItems) ? otherItems : (typeof otherItems === 'string' ? [otherItems] : []);
  
  return [...safeItems, ...safeOtherItems].map((item: string, index: number) => (
    <div key={`${item}-${index}`} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
      {item}
    </div>
  ));
};

const PreferencesSection = () => {
  const { preferences, updatePreferences, isLoading, learnedPreferences, dismissLearnedPreference } = usePreferences();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const { toast } = useToast();

  // Confirmation dialog states
  const [resetPreferencesDialogOpen, setResetPreferencesDialogOpen] = useState(false);
  const [clearConstraintsDialogOpen, setClearConstraintsDialogOpen] = useState(false);
  const [clearLearnedDialogOpen, setClearLearnedDialogOpen] = useState(false);

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
        skin_type: [],
        hair_type: [],
        food_preferences: [],
        lifestyle: [],
        genre_preferences: [],
        goals: [],
        other_skin_type: '',
        other_hair_type: '',
        other_food_preferences: '',
        other_lifestyle: '',
        other_genre_preferences: '',
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

  const handleApproveLearned = (scope: string, key: string, value: any) => {
    toast({
      title: "Preference approved",
      description: `"${key}" has been added to your preferences.`
    });
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
  const approvedLearnedCount = activeLearned.filter(p => p.approvedAt).length;

  // Count total preferences for badge
  const preferencesCount = [
    preferences?.skin_type?.length || 0,
    preferences?.other_skin_type ? 1 : 0,
    preferences?.hair_type?.length || 0,
    preferences?.other_hair_type ? 1 : 0,
    preferences?.food_preferences?.length || 0,
    preferences?.other_food_preferences ? 1 : 0,
    preferences?.lifestyle?.length || 0,
    preferences?.other_lifestyle ? 1 : 0,
    preferences?.genre_preferences?.length || 0,
    preferences?.other_genre_preferences ? 1 : 0,
    preferences?.goals?.length || 0,
  ].reduce((a, b) => a + b, 0);

  // Check if each section has content (for disabling destructive actions)
  const hasFormPreferences = Object.keys(preferences || {}).some(key => 
    !['constraints', 'custom_preferences', 'last_updated', 'onboarding_completed'].includes(key) &&
    preferences[key] !== undefined &&
    preferences[key] !== null &&
    (Array.isArray(preferences[key]) ? preferences[key].length > 0 : 
      typeof preferences[key] === 'string' ? preferences[key].length > 0 : false)
  );
  const hasConstraints = constraintCount > 0;
  const hasLearnedData = activeLearned.length > 0;

  // Generate summary for Your Preferences
  const getPreferencesSummary = (): string => {
    const items: string[] = [];
    if (preferences?.skin_type?.length) items.push(...preferences.skin_type);
    if (preferences?.other_skin_type) items.push(preferences.other_skin_type);
    if (preferences?.hair_type?.length) items.push(...preferences.hair_type);
    if (preferences?.other_hair_type) items.push(preferences.other_hair_type);
    if (preferences?.food_preferences?.length) items.push(...preferences.food_preferences);
    if (preferences?.other_food_preferences) items.push(preferences.other_food_preferences);
    if (preferences?.lifestyle?.length) items.push(...preferences.lifestyle);
    if (preferences?.other_lifestyle) items.push(preferences.other_lifestyle);
    if (preferences?.genre_preferences?.length) items.push(...preferences.genre_preferences);
    if (preferences?.other_genre_preferences) items.push(preferences.other_genre_preferences);
    if (preferences?.goals?.length) items.push(`${preferences.goals.length} goal${preferences.goals.length > 1 ? 's' : ''}`);
    
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
    if (approvedLearnedCount) parts.push(`${approvedLearnedCount} approved`);
    if (pendingLearnedCount) parts.push(`${pendingLearnedCount} pending review`);
    return parts.join(' • ') || 'No learned data';
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
          <Accordion type="multiple" defaultValue={["preferences"]} className="w-full">
            {/* Section 1: Your Preferences */}
            <AccordionItem value="preferences" className="border-b">
              <div className="flex items-center justify-between">
                <AccordionTrigger className="flex-1 hover:no-underline py-4 [&>svg:last-child]:hidden">
                  <div className="flex flex-col items-start">
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
                    {preferences.skin_type && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">🧴 Skin Type</h4>
                        <div className="flex flex-wrap gap-1">
                          {renderPreferenceTags(preferences.skin_type, preferences.other_skin_type)}
                        </div>
                      </div>
                    )}

                    {preferences.hair_type && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">💇 Hair Type</h4>
                        <div className="flex flex-wrap gap-1">
                          {renderPreferenceTags(preferences.hair_type, preferences.other_hair_type)}
                        </div>
                      </div>
                    )}

                    {preferences.food_preferences && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">🍱 Food Preferences</h4>
                        <div className="flex flex-wrap gap-1">
                          {renderPreferenceTags(preferences.food_preferences, preferences.other_food_preferences)}
                        </div>
                      </div>
                    )}

                    {preferences.lifestyle && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">🧘 Lifestyle</h4>
                        <div className="flex flex-wrap gap-1">
                          {renderPreferenceTags(preferences.lifestyle, preferences.other_lifestyle)}
                        </div>
                      </div>
                    )}

                    {preferences.genre_preferences && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">🎬 Genre Preferences</h4>
                        <div className="flex flex-wrap gap-1">
                          {renderPreferenceTags(preferences.genre_preferences, preferences.other_genre_preferences)}
                        </div>
                      </div>
                    )}

                    {preferences.goals && (
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm">🎯 Goals</h4>
                        <div className="flex flex-wrap gap-1">
                          {renderPreferenceTags(preferences.goals)}
                        </div>
                      </div>
                    )}

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
              <div className="flex items-center justify-between">
                <AccordionTrigger className="flex-1 hover:no-underline py-4 [&>svg:last-child]:hidden">
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-red-500" />
                      <span className="font-medium">Things to Avoid</span>
                      {constraintCount > 0 && (
                        <Badge variant="destructive" className="ml-2 text-xs">
                          {constraintCount}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 text-left">
                      {getConstraintsSummary()}
                    </span>
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
              <div className="flex items-center justify-between">
                <AccordionTrigger className="flex-1 hover:no-underline py-4 [&>svg:last-child]:hidden">
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-500" />
                      <span className="font-medium">Learned from Conversations</span>
                      {pendingLearnedCount > 0 && (
                        <Badge className="ml-2 text-xs bg-yellow-500">
                          {pendingLearnedCount} pending
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 text-left">
                      {getLearnedSummary()}
                    </span>
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
    </>
  );
};

export default PreferencesSection;

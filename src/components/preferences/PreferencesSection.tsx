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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Shield, Brain, Settings2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConstraintsType, LearnedPreference } from '@/types/preferences';

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
  const { preferences, updatePreferences, isLoading } = usePreferences();
  const [isEditing, setIsEditing] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const { toast } = useToast();

  const handleEditClick = () => {
    setEditModalOpen(true);
  };

  const handleSaveSuccess = () => {
    setIsEditing(false);
    setEditModalOpen(false);
    toast({
      title: "Preferences updated",
      description: "Your personalization preferences have been saved."
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditModalOpen(false);
  };

  const handleResetPreferences = async () => {
    try {
      await updatePreferences({});
      toast({
        title: "Preferences reset",
        description: "All your preferences have been cleared."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not reset preferences. Please try again.",
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

  // Mock learned preferences (TODO: integrate with user_conversation_memory)
  const learnedPreferences: LearnedPreference[] = [];

  const handleApproveLearned = (scope: string, key: string, value: any) => {
    // TODO: Mark preference as approved in database
    toast({
      title: "Preference approved",
      description: `"${key}" has been added to your preferences.`
    });
  };

  const handleDismissLearned = (scope: string, key: string) => {
    // TODO: Mark preference as dismissed in database
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

  const pendingLearnedCount = learnedPreferences.filter(p => !p.approvedAt && !p.dismissed).length;

  if (isLoading) {
    return (
      <div className="p-4 bg-accent/30 rounded-md">
        <p className="text-sm text-muted-foreground animate-pulse">Loading preferences...</p>
      </div>
    );
  }

  const hasFormPreferences = Object.keys(preferences || {}).some(key => 
    !['constraints', 'custom_preferences', 'last_updated', 'onboarding_completed'].includes(key) &&
    preferences[key] !== undefined &&
    preferences[key] !== null &&
    (Array.isArray(preferences[key]) ? preferences[key].length > 0 : true)
  );

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
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-red-600 focus-visible:ring-0 focus-visible:ring-offset-0">
                    <Trash2 className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Preferences</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all your personalization preferences. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="focus-visible:ring-0 focus-visible:ring-offset-0">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleResetPreferences}
                      className="bg-red-600 hover:bg-red-700 focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      Reset All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={["preferences"]} className="w-full">
            {/* Section 1: Your Preferences */}
            <AccordionItem value="preferences" className="border-b">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Your Preferences</span>
                  {hasFormPreferences && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Set
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
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

                    <Button 
                      onClick={handleEditClick} 
                      variant="outline"
                      size="sm"
                      className="mt-4 focus-visible:ring-0 focus-visible:ring-offset-0"
                    >
                      Edit Preferences
                    </Button>
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
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-500" />
                  <span className="font-medium">Things to Avoid</span>
                  {constraintCount > 0 && (
                    <Badge variant="destructive" className="ml-2 text-xs">
                      {constraintCount}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <ConstraintsSection
                  constraints={constraints}
                  onUpdateConstraints={handleUpdateConstraints}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Section 3: Learned from Conversations */}
            <AccordionItem value="learned" className="border-0">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  <span className="font-medium">Learned from Conversations</span>
                  {pendingLearnedCount > 0 && (
                    <Badge className="ml-2 text-xs bg-yellow-500">
                      {pendingLearnedCount} pending
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
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

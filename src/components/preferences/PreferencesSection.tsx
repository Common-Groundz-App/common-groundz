
import React, { useState } from 'react';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import PreferencesForm from './PreferencesForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

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
            {!isEditing && Object.keys(preferences || {}).length > 0 && (
              <div className="flex gap-2">
                <Button onClick={handleEditClick} variant="outline" size="sm" className="focus-visible:ring-0 focus-visible:ring-offset-0">
                  Edit Preferences
                </Button>
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
            )}
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(preferences || {}).length > 0 ? (
            <div className="space-y-6">
              {preferences.skin_type && (
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">🧴 Skin Type</h4>
                  <div className="flex flex-wrap gap-1">
                    {renderPreferenceTags(preferences.skin_type, preferences.other_skin_type)}
                  </div>
                  <Separator className="my-2" />
                </div>
              )}

              {preferences.hair_type && (
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">💇 Hair Type</h4>
                  <div className="flex flex-wrap gap-1">
                    {renderPreferenceTags(preferences.hair_type, preferences.other_hair_type)}
                  </div>
                  <Separator className="my-2" />
                </div>
              )}

              {preferences.food_preferences && (
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">🍱 Food Preferences</h4>
                  <div className="flex flex-wrap gap-1">
                    {renderPreferenceTags(preferences.food_preferences, preferences.other_food_preferences)}
                  </div>
                  <Separator className="my-2" />
                </div>
              )}

              {preferences.lifestyle && (
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">🧘 Lifestyle</h4>
                  <div className="flex flex-wrap gap-1">
                    {renderPreferenceTags(preferences.lifestyle, preferences.other_lifestyle)}
                  </div>
                  <Separator className="my-2" />
                </div>
              )}

              {preferences.genre_preferences && (
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">🎬 Genre Preferences</h4>
                  <div className="flex flex-wrap gap-1">
                    {renderPreferenceTags(preferences.genre_preferences, preferences.other_genre_preferences)}
                  </div>
                  <Separator className="my-2" />
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
            <div className="text-center p-4">
              <p className="text-muted-foreground mb-2">
                You haven't set any preferences yet.
              </p>
              <Button 
                onClick={handleEditClick} 
                className="focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                Set Your Preferences
              </Button>
            </div>
          )}
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

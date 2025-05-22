
import React, { useState } from 'react';
import { usePreferences } from '@/contexts/PreferencesContext';
import SelectablePills from './SelectablePills';
import TagInput from './TagInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import PreferencesForm from './PreferencesForm';

const PreferencesSection = () => {
  const { preferences, updatePreferences, isLoading } = usePreferences();
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleSaveSuccess = () => {
    setIsEditing(false);
    toast({
      title: "Preferences updated",
      description: "Your personalization preferences have been saved."
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-accent/30 rounded-md">
        <p className="text-sm text-muted-foreground animate-pulse">Loading preferences...</p>
      </div>
    );
  }

  return (
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
            <Button onClick={handleEditClick} variant="outline" size="sm">
              Edit Preferences
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing || Object.keys(preferences || {}).length === 0 ? (
          <PreferencesForm 
            initialPreferences={preferences} 
            onSaveSuccess={handleSaveSuccess} 
            onCancel={handleCancel}
          />
        ) : (
          <div className="space-y-6">
            {Object.keys(preferences).length > 0 ? (
              <>
                {preferences.skin_type && (
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">🧴 Skin Type</h4>
                    <div className="flex flex-wrap gap-1">
                      {preferences.skin_type.map((type: string) => (
                        <div key={type} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {type}
                        </div>
                      ))}
                      {preferences.other_skin_type?.map((type: string) => (
                        <div key={type} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {type}
                        </div>
                      ))}
                    </div>
                    <Separator className="my-2" />
                  </div>
                )}

                {preferences.hair_type && (
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">💇 Hair Type</h4>
                    <div className="flex flex-wrap gap-1">
                      {preferences.hair_type.map((type: string) => (
                        <div key={type} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {type}
                        </div>
                      ))}
                      {preferences.other_hair_type?.map((type: string) => (
                        <div key={type} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {type}
                        </div>
                      ))}
                    </div>
                    <Separator className="my-2" />
                  </div>
                )}

                {preferences.food_preferences && (
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">🍱 Food Preferences</h4>
                    <div className="flex flex-wrap gap-1">
                      {preferences.food_preferences.map((pref: string) => (
                        <div key={pref} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {pref}
                        </div>
                      ))}
                      {preferences.other_food_preferences?.map((pref: string) => (
                        <div key={pref} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {pref}
                        </div>
                      ))}
                    </div>
                    <Separator className="my-2" />
                  </div>
                )}

                {preferences.lifestyle && (
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">🧘 Lifestyle</h4>
                    <div className="flex flex-wrap gap-1">
                      {preferences.lifestyle.map((style: string) => (
                        <div key={style} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {style}
                        </div>
                      ))}
                      {preferences.other_lifestyle?.map((style: string) => (
                        <div key={style} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {style}
                        </div>
                      ))}
                    </div>
                    <Separator className="my-2" />
                  </div>
                )}

                {preferences.genre_preferences && (
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">🎬 Genre Preferences</h4>
                    <div className="flex flex-wrap gap-1">
                      {preferences.genre_preferences.map((genre: string) => (
                        <div key={genre} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {genre}
                        </div>
                      ))}
                      {preferences.other_genre_preferences?.map((genre: string) => (
                        <div key={genre} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {genre}
                        </div>
                      ))}
                    </div>
                    <Separator className="my-2" />
                  </div>
                )}

                {preferences.goals && (
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm">🎯 Goals</h4>
                    <div className="flex flex-wrap gap-1">
                      {preferences.goals.map((goal: string) => (
                        <div key={goal} className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-xs">
                          {goal}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted-foreground mb-2">
                  You haven't set any preferences yet.
                </p>
                <Button onClick={handleEditClick}>Set Your Preferences</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PreferencesSection;

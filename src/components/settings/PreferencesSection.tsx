
import React from 'react';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PreferencesSection: React.FC = () => {
  const { preferences, setShowOnboarding } = usePreferences();

  const hasPreferences = Object.keys(preferences || {}).length > 0;

  const handleEditPreferences = () => {
    setShowOnboarding(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Personalization Preferences</CardTitle>
        <CardDescription>
          Manage your preferences to get better recommendations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPreferences ? (
          <div className="space-y-4">
            {/* Display existing preferences summary */}
            <div className="space-y-3">
              {preferences.skin_type?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm">Skin Type</h4>
                  <p className="text-muted-foreground text-sm">
                    {preferences.skin_type.join(', ')}
                    {preferences.other_skin_type && `, ${preferences.other_skin_type}`}
                  </p>
                </div>
              )}
              
              {preferences.hair_type?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm">Hair Type</h4>
                  <p className="text-muted-foreground text-sm">
                    {preferences.hair_type.join(', ')}
                    {preferences.other_hair_type && `, ${preferences.other_hair_type}`}
                  </p>
                </div>
              )}
              
              {preferences.food_preferences?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm">Food Preferences</h4>
                  <p className="text-muted-foreground text-sm">
                    {preferences.food_preferences.join(', ')}
                    {preferences.other_food_preferences && `, ${preferences.other_food_preferences}`}
                  </p>
                </div>
              )}
              
              {preferences.goals?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm">Goals</h4>
                  <p className="text-muted-foreground text-sm">
                    {preferences.goals.join(', ')}
                  </p>
                </div>
              )}
              
              {preferences.lifestyle?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm">Lifestyle</h4>
                  <p className="text-muted-foreground text-sm">
                    {preferences.lifestyle.join(', ')}
                    {preferences.other_lifestyle && `, ${preferences.other_lifestyle}`}
                  </p>
                </div>
              )}
              
              {preferences.genre_preferences?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm">Genre Preferences</h4>
                  <p className="text-muted-foreground text-sm">
                    {preferences.genre_preferences.join(', ')}
                    {preferences.other_genres && `, ${preferences.other_genres}`}
                  </p>
                </div>
              )}
            </div>
            
            <Button onClick={handleEditPreferences}>
              Edit Preferences
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">
              You haven't set your preferences yet. Setting preferences helps us 
              provide you with personalized recommendations.
            </p>
            <Button onClick={handleEditPreferences}>
              Set Your Preferences
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PreferencesSection;

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Shield, 
  User, 
  Brain, 
  Download, 
  ArrowLeft,
  Info,
  Bot
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';
import { INTENT_COLORS, getConfidenceLevel, PreferenceCategory, PreferenceValue } from '@/types/preferences';
import { cn } from '@/lib/utils';
import { CONSTRAINT_CATEGORIES, getConstraintsForCategory, getIntentStyles, getScopeLabel } from '@/utils/constraintUtils';

const YourData = () => {
  const { user } = useAuth();
  const { preferences, learnedPreferences, isLoading, unifiedConstraints } = usePreferences();

  if (!user) {
    return <div>Loading...</div>;
  }

  const getInitialActiveTab = () => 'Settings';

  const handleExportData = () => {
    const exportData = {
      preferences,
      learnedPreferences,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `common-groundz-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper to render preference values with source indicator
  const renderPreferenceValues = (category: PreferenceCategory | undefined) => {
    if (!category?.values || category.values.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2">
        {category.values.map((pref: PreferenceValue, index: number) => (
          <Badge 
            key={`${pref.normalizedValue}-${index}`}
            variant="secondary"
            className={cn(
              "flex items-center gap-1",
              pref.source === 'chatbot' && "bg-purple-100 dark:bg-purple-500/20"
            )}
          >
            {pref.value}
            {pref.source === 'chatbot' && (
              <Bot className="h-3 w-3 opacity-70" />
            )}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile Header */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
        <div className="container p-3 mx-auto flex items-center gap-3">
          <Link to="/settings">
            <Button variant="ghost" size="sm" className="p-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Logo size="sm" />
        </div>
      </div>
      
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <div className="hidden xl:block">
          <VerticalTubelightNavbar 
            initialActiveTab={getInitialActiveTab()}
            className="fixed left-0 top-0 h-screen pt-4 pl-4" 
          />
        </div>
        
        <div className="flex-1 pt-16 xl:pt-0 xl:ml-64 min-w-0">
          <div className="container max-w-4xl mx-auto p-4 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold">Your Data</h1>
                <p className="text-muted-foreground">
                  Everything the AI knows about you - full transparency
                </p>
              </div>
              <Button variant="outline" onClick={handleExportData} className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading your data...</div>
            ) : (
              <Accordion type="multiple" defaultValue={['constraints', 'preferences', 'learned']} className="space-y-4">
                {/* Constraints Section */}
                <AccordionItem value="constraints" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <Shield className="h-5 w-5 text-red-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold">Your Constraints</h3>
                        <p className="text-sm text-muted-foreground">Rules that are NEVER violated</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {/* Category-based constraint display */}
                      {CONSTRAINT_CATEGORIES.map(category => {
                        const categoryConstraints = getConstraintsForCategory(unifiedConstraints, category.id);
                        if (categoryConstraints.length === 0) return null;
                        
                        return (
                          <div key={category.id}>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <span>{category.emoji}</span>
                              {category.name}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {categoryConstraints.map(constraint => {
                                const intentStyles = getIntentStyles(constraint.intent);
                                return (
                                  <Badge 
                                    key={constraint.id} 
                                    variant="outline" 
                                    className={cn(intentStyles.bg, intentStyles.text, "flex items-center gap-1")}
                                  >
                                    {constraint.targetValue}
                                    {constraint.scope !== 'global' && (
                                      <span className="opacity-70 text-[10px]">({getScopeLabel(constraint.scope)})</span>
                                    )}
                                    {constraint.source === 'chatbot' && (
                                      <Bot className="h-3 w-3 opacity-70" />
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Budget display */}
                      {unifiedConstraints?.budget && unifiedConstraints.budget !== 'no_preference' && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <span>💰</span>
                            Budget
                          </h4>
                          <Badge variant="outline">{unifiedConstraints.budget}</Badge>
                        </div>
                      )}
                      
                      {/* Empty state */}
                      {(!unifiedConstraints?.items?.length) && 
                       (!unifiedConstraints?.budget || unifiedConstraints.budget === 'no_preference') && (
                        <p className="text-sm text-muted-foreground">No constraints set yet.</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Preferences Section */}
                <AccordionItem value="preferences" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <User className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold">Your Preferences</h3>
                        <p className="text-sm text-muted-foreground">Form and AI-learned preferences</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {/* Canonical preference categories */}
                      {preferences?.skin_type?.values && preferences.skin_type.values.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Skin Type</h4>
                          {renderPreferenceValues(preferences.skin_type)}
                        </div>
                      )}
                      
                      {preferences?.hair_type?.values && preferences.hair_type.values.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Hair Type</h4>
                          {renderPreferenceValues(preferences.hair_type)}
                        </div>
                      )}
                      
                      {preferences?.food_preferences?.values && preferences.food_preferences.values.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Food Preferences</h4>
                          {renderPreferenceValues(preferences.food_preferences)}
                        </div>
                      )}
                      
                      {preferences?.lifestyle?.values && preferences.lifestyle.values.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Lifestyle</h4>
                          {renderPreferenceValues(preferences.lifestyle)}
                        </div>
                      )}
                      
                      {preferences?.genre_preferences?.values && preferences.genre_preferences.values.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Genre Preferences</h4>
                          {renderPreferenceValues(preferences.genre_preferences)}
                        </div>
                      )}
                      
                      {preferences?.goals?.values && preferences.goals.values.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Goals</h4>
                          {renderPreferenceValues(preferences.goals)}
                        </div>
                      )}
                      
                      {/* Custom categories */}
                      {preferences?.custom_categories && Object.entries(preferences.custom_categories).map(([categoryName, category]) => {
                        if (!category?.values || category.values.length === 0) return null;
                        return (
                          <div key={categoryName}>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Bot className="h-4 w-4 text-purple-500" />
                              {categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}
                            </h4>
                            {renderPreferenceValues(category)}
                          </div>
                        );
                      })}
                      
                      {/* Show empty state if no preferences */}
                      {!preferences?.skin_type?.values?.length &&
                       !preferences?.hair_type?.values?.length &&
                       !preferences?.food_preferences?.values?.length &&
                       !preferences?.lifestyle?.values?.length &&
                       !preferences?.genre_preferences?.values?.length &&
                       !preferences?.goals?.values?.length &&
                       !Object.keys(preferences?.custom_categories || {}).length && (
                        <p className="text-sm text-muted-foreground">No preferences set yet.</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Learned Data Section (Pending Review) */}
                <AccordionItem value="learned" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <Brain className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold">Pending Review</h3>
                        <p className="text-sm text-muted-foreground">AI-detected preferences awaiting your approval</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {learnedPreferences && learnedPreferences.length > 0 ? (
                        learnedPreferences.map((pref: any, index: number) => {
                          const confidence = getConfidenceLevel(pref.confidence);
                          return (
                            <div key={index} className="p-3 bg-accent/30 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">{pref.scope}</Badge>
                                <span className="text-sm font-medium">{pref.key}</span>
                                <Badge variant="outline" className={cn('text-xs ml-auto', confidence.color)}>
                                  {confidence.label} ({Math.round(pref.confidence * 100)}%)
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {typeof pref.value === 'object' ? JSON.stringify(pref.value) : String(pref.value)}
                              </p>
                              {pref.evidence && (
                                <p className="text-xs text-muted-foreground mt-1 italic">
                                  "{pref.evidence}"
                                </p>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No pending items. Approved preferences appear in their respective sections above.
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* How Priority Works */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Info className="h-5 w-5" />
                      How Priority Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-red-600">1</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">Constraints (Highest)</p>
                          <p className="text-xs text-muted-foreground">Never violated - things you want to strictly avoid or prefer</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-blue-600">2</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">Your Preferences</p>
                          <p className="text-xs text-muted-foreground">What you've set manually or approved from AI suggestions</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-purple-600">3</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">Pending Review (Lowest)</p>
                          <p className="text-xs text-muted-foreground">AI-detected preferences that need your approval before they're used</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Accordion>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default YourData;

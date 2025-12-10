import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Shield, 
  User, 
  Brain, 
  Download, 
  AlertTriangle,
  ArrowLeft,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';
import { useIsMobile } from '@/hooks/use-mobile';
import { INTENT_COLORS, getConfidenceLevel } from '@/types/preferences';
import { cn } from '@/lib/utils';

const YourData = () => {
  const { user } = useAuth();
  const { preferences, learnedPreferences, isLoading } = usePreferences();
  const isMobile = useIsMobile();
  
  const constraints = preferences?.constraints || {};
  const customPreferences = preferences?.custom_preferences || [];

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
                      {/* Hardcoded constraints */}
                      {constraints.avoidIngredients?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Ingredients to Avoid</h4>
                          <div className="flex flex-wrap gap-2">
                            {constraints.avoidIngredients.map((item: string) => (
                              <Badge key={item} variant="outline" className="bg-red-500/10 text-red-600">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {constraints.avoidBrands?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Brands to Avoid</h4>
                          <div className="flex flex-wrap gap-2">
                            {constraints.avoidBrands.map((item: string) => (
                              <Badge key={item} variant="outline" className="bg-red-500/10 text-red-600">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {constraints.budget && constraints.budget !== 'no_preference' && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Budget</h4>
                          <Badge variant="outline">{constraints.budget}</Badge>
                        </div>
                      )}
                      
                      {/* Custom constraints */}
                      {constraints.custom?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Custom Constraints</h4>
                          <div className="space-y-2">
                            {constraints.custom.map((c: any) => {
                              const style = INTENT_COLORS[c.intent as keyof typeof INTENT_COLORS];
                              return (
                                <div key={c.id} className="flex items-center gap-2 p-2 bg-accent/30 rounded">
                                  <Badge variant="outline" className={cn(style?.bg, style?.text)}>
                                    {style?.label || c.intent}
                                  </Badge>
                                  <span className="text-sm">{c.category}: {c.rule} - {c.value}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {!constraints.avoidIngredients?.length && 
                       !constraints.avoidBrands?.length && 
                       !constraints.custom?.length &&
                       (!constraints.budget || constraints.budget === 'no_preference') && (
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
                        <p className="text-sm text-muted-foreground">Form and custom preferences</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-4">
                      {/* Form preferences */}
                      {preferences?.skin_type && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Skin Type</h4>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(preferences.skin_type) ? preferences.skin_type : [preferences.skin_type]).map((item: string) => (
                              <Badge key={item} variant="secondary">{item}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {preferences?.hair_type && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Hair Type</h4>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(preferences.hair_type) ? preferences.hair_type : [preferences.hair_type]).map((item: string) => (
                              <Badge key={item} variant="secondary">{item}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {preferences?.food_preferences && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Food Preferences</h4>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(preferences.food_preferences) ? preferences.food_preferences : [preferences.food_preferences]).map((item: string) => (
                              <Badge key={item} variant="secondary">{item}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {preferences?.goals && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Goals</h4>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(preferences.goals) ? preferences.goals : [preferences.goals]).map((item: string) => (
                              <Badge key={item} variant="secondary">{item}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Custom preferences */}
                      {customPreferences.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Custom Preferences</h4>
                          <div className="space-y-2">
                            {customPreferences.map((p: any) => (
                              <div key={p.id} className="flex items-center gap-2 p-2 bg-accent/30 rounded">
                                <Badge variant="outline">{p.category}</Badge>
                                <span className="text-sm">{p.key}: {p.value}</span>
                                <Badge variant="outline" className="text-xs ml-auto">
                                  {p.source === 'manual' ? 'Added by you' : 'From chatbot'}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Learned Data Section */}
                <AccordionItem value="learned" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <Brain className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold">AI-Learned Data</h3>
                        <p className="text-sm text-muted-foreground">What the chatbot has learned about you</p>
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
                          No learned data yet. Chat with the AI assistant to start learning your preferences.
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
                          <p className="font-medium text-sm">User Preferences</p>
                          <p className="text-xs text-muted-foreground">What you've set manually or approved from suggestions</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-purple-600">3</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">AI-Learned (Lowest)</p>
                          <p className="text-xs text-muted-foreground">Inferred from conversations - used as suggestions, never overrides your settings</p>
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

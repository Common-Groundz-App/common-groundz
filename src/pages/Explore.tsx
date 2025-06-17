
import React, { useState, useEffect } from 'react';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { PillTabs } from '@/components/ui/pill-tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { cn } from '@/lib/utils';
import { Star, Film, Book, MapPin, ShoppingBag, Users, Sparkles } from 'lucide-react';
import { useExploreData } from '@/hooks/use-explore-data';
import { PersonalizedSection } from '@/components/explore/PersonalizedSection';
import { TrendingSection } from '@/components/explore/TrendingSection';
import { CollectionSection } from '@/components/explore/CollectionSection';
import { DiscoverySection } from '@/components/explore/DiscoverySection';
import { FeaturedEntities } from '@/components/explore/FeaturedEntities';

const Explore = () => {
  const isMobile = useIsMobile();
  const isTablet = useIsMobile(630);
  const [activeTab, setActiveTab] = useState('all');

  const {
    personalizedEntities,
    trendingEntities,
    hiddenGems,
    newEntities,
    collections,
    handleEntityView,
    handleEntityInteraction,
    isLoggedIn
  } = useExploreData(activeTab);

  // Tab items configuration
  const tabItems = [
    { value: 'all', label: 'All', emoji: '🌟' },
    { value: 'movie', label: 'Movies', emoji: '🎬' },
    { value: 'book', label: 'Books', emoji: '📚' },
    { value: 'place', label: 'Places', emoji: '📍' },
    { value: 'product', label: 'Products', emoji: '🛍️' }
  ];

  const tubelightTabItems = [
    { value: 'all', label: 'All', icon: Star },
    { value: 'movie', label: 'Movies', icon: Film },
    { value: 'book', label: 'Books', icon: Book },
    { value: 'place', label: 'Places', icon: MapPin },
    { value: 'product', label: 'Products', icon: ShoppingBag }
  ];

  // Get entities for personalized section
  const getPersonalizedEntities = () => {
    if (!isLoggedIn || !personalizedEntities.length) return [];
    
    // Match personalized entity IDs with trending entities for display
    const personalizedIds = personalizedEntities.map(p => p.entity_id);
    return trendingEntities.filter(entity => personalizedIds.includes(entity.id));
  };

  const personalizedDisplayEntities = getPersonalizedEntities();

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* Mobile Header */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
        <div className="container p-3 mx-auto flex justify-start min-w-0">
          <Logo size="sm" />
        </div>
      </div>
      
      <div className="flex flex-1 min-w-0">
        {/* Desktop Sidebar */}
        <div className="hidden xl:block">
          <VerticalTubelightNavbar 
            initialActiveTab="Explore"
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        </div>
        
        <div className={cn(
          "flex-1 min-w-0",
          "pt-16 xl:pt-0 xl:pl-64"
        )}>
          <div className="container max-w-7xl mx-auto p-4 md:p-8 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Sparkles className="w-8 h-8 text-primary" />
                  Explore
                </h1>
                <p className="text-muted-foreground">Discover amazing places, products, and experiences</p>
              </div>
            </div>
            
            {/* Responsive Navigation */}
            {isTablet ? (
              <div className="mb-6 overflow-x-auto">
                <PillTabs
                  items={tabItems}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </div>
            ) : (
              <div className="mb-6 overflow-x-auto">
                <TubelightTabs
                  defaultValue={activeTab}
                  items={tubelightTabItems}
                  onValueChange={setActiveTab}
                  className="mb-6"
                >
                  <TabsContent value={activeTab}>
                    {/* Content will be rendered below */}
                  </TabsContent>
                </TubelightTabs>
              </div>
            )}
            
            <div className="space-y-12">
              {/* Personalized Section - Only for logged-in users */}
              {isLoggedIn && personalizedDisplayEntities.length > 0 && (
                <PersonalizedSection
                  entities={personalizedDisplayEntities}
                  personalizedData={personalizedEntities}
                  onEntityView={handleEntityView}
                />
              )}
              
              {/* Trending Section */}
              {trendingEntities.length > 0 && (
                <TrendingSection
                  entities={trendingEntities}
                  onEntityView={handleEntityView}
                />
              )}
              
              {/* Entity Collections */}
              {collections.map((collection) => (
                <CollectionSection
                  key={collection.id}
                  collection={collection}
                  onEntityView={handleEntityView}
                />
              ))}
              
              {/* Discovery Section */}
              <DiscoverySection
                hiddenGems={hiddenGems}
                newEntities={newEntities}
                onEntityView={handleEntityView}
              />
              
              {/* Fallback: Featured Entities */}
              {!trendingEntities.length && !collections.length && (
                <FeaturedEntities />
              )}
              
              {/* No content message */}
              {!trendingEntities.length && !collections.length && !hiddenGems.length && !newEntities.length && (
                <div className="text-center py-12">
                  <Sparkles className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No content available</h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'all' 
                      ? 'Check back soon for amazing discoveries!' 
                      : `No ${activeTab}s available at the moment.`
                    }
                  </p>
                </div>
              )}
            </div>
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

export default Explore;

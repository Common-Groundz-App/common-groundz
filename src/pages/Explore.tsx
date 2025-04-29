
import React, { useState, useEffect } from 'react';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TubelightTabs } from '@/components/ui/tubelight-tabs';
import { UserDirectoryList } from '@/components/explore/UserDirectoryList';
import { cn } from "@/lib/utils";
import { Filter, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useSearch } from '@/hooks/use-search';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { FixedWidthLayout } from '@/components/layout/FixedWidthLayout';

const SIDEBAR_WIDTH = "275px";
const CONTENT_WIDTH = "600px";
const RIGHT_COLUMN_WIDTH = "350px";

const Explore = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [sortOption, setSortOption] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const { results, isLoading } = useSearch(searchQuery);
  
  const getInitialActiveTab = () => {
    return 'Explore';  // Changed from 'People' to 'Explore'
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  const tabItems = [
    {
      value: "people",
      label: "People",
      icon: Users
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
          <div className="container p-3 mx-auto flex justify-start">
            <Logo size="sm" />
          </div>
        </div>
      )}
      
      <FixedWidthLayout className="flex-1">
        <div className="flex flex-1">
          {!isMobile && (
            <VerticalTubelightNavbar 
              initialActiveTab={getInitialActiveTab()}
              className="fixed left-1/2 -translate-x-[calc(50%+275px/2+300px)] top-0 h-screen pt-4 w-[275px]" 
            />
          )}
          
          <div className={cn(
            "flex-1 pt-16 md:ml-[84px] lg:ml-[275px]",
          )}>
            <div className="flex w-full">
              <div className="w-full md:w-[600px] border-x p-4 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-3xl font-bold">Explore</h1>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="ml-auto flex items-center gap-2">
                        <Filter size={16} />
                        Sort
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuRadioGroup value={sortOption} onValueChange={setSortOption}>
                        <DropdownMenuRadioItem value="popular">Most Popular</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="recent">Recently Joined</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="active">Most Active</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="relative mb-6">
                  <div className="flex items-center border rounded-lg overflow-hidden bg-background">
                    <div className="pl-3 text-muted-foreground">
                      <Search size={18} />
                    </div>
                    <Input
                      type="text"
                      placeholder="Search for people..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  
                  {searchQuery && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-10 max-h-72 overflow-y-auto">
                      {isLoading && (
                        <div className="p-4 text-center">
                          <p className="text-sm text-muted-foreground">Searching...</p>
                        </div>
                      )}
                      
                      {!isLoading && results.length === 0 && (
                        <div className="p-4 text-center">
                          <p className="text-sm text-muted-foreground">No users found</p>
                        </div>
                      )}
                      
                      {!isLoading && results.map(user => (
                        <Link
                          key={user.id}
                          to={`/profile/${user.id}`}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors"
                          onClick={() => setSearchQuery('')}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || undefined} alt={user.username || 'User'} />
                            <AvatarFallback>
                              {user.username?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{user.username || 'Unknown User'}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.bio || 'No bio available'}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                
                <TubelightTabs defaultValue="people" items={tabItems}>
                  <TabsContent value="people">
                    <UserDirectoryList sortOption={sortOption} />
                  </TabsContent>
                </TubelightTabs>
              </div>
              
              {!isMobile && (
                <div className="hidden lg:block w-[350px] pl-6">
                  {/* Right sidebar content can be added here */}
                </div>
              )}
            </div>
          </div>
        </div>
      </FixedWidthLayout>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default Explore;

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Clock, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SmartSuggestionsProps {
  query: string;
  activeTab: string;
  onSuggestionClick: (suggestion: string) => void;
}

interface SuggestionItem {
  text: string;
  type: 'trending' | 'recent' | 'popular' | 'related';
  icon: React.ReactNode;
}

export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({
  query,
  activeTab,
  onSuggestionClick
}) => {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        setLoading(true);
        
        // Get trending entities based on recent activity
        const { data: trendingData } = await supabase
          .from('entities')
          .select('name, type')
          .eq('is_deleted', false)
          .eq('approval_status', 'approved')
          .gte('trending_score', 0.1)
          .order('trending_score', { ascending: false })
          .limit(5);

        // Get recently added entities
        const { data: recentData } = await supabase
          .from('entities')
          .select('name, type')
          .eq('is_deleted', false)
          .eq('approval_status', 'approved')
          .eq('user_created', true)
          .order('created_at', { ascending: false })
          .limit(3);

        // Get popular entities (high view counts or recommendations)
        const { data: popularData } = await supabase
          .from('entities')
          .select('name, type, recent_views_24h')
          .eq('is_deleted', false)
          .eq('approval_status', 'approved')
          .gt('recent_views_24h', 0)
          .order('recent_views_24h', { ascending: false })
          .limit(3);

        const newSuggestions: SuggestionItem[] = [];

        // Add trending suggestions
        if (trendingData) {
          trendingData.forEach(item => {
            if (activeTab === 'all' || activeTab === item.type || item.name.toLowerCase().includes(query.toLowerCase())) {
              newSuggestions.push({
                text: item.name,
                type: 'trending',
                icon: <TrendingUp className="w-3 h-3" />
              });
            }
          });
        }

        // Add recent suggestions
        if (recentData) {
          recentData.forEach(item => {
            if (activeTab === 'all' || activeTab === item.type || item.name.toLowerCase().includes(query.toLowerCase())) {
              newSuggestions.push({
                text: item.name,
                type: 'recent',
                icon: <Clock className="w-3 h-3" />
              });
            }
          });
        }

        // Add popular suggestions
        if (popularData) {
          popularData.forEach(item => {
            if (activeTab === 'all' || activeTab === item.type || item.name.toLowerCase().includes(query.toLowerCase())) {
              newSuggestions.push({
                text: item.name,
                type: 'popular',
                icon: <Users className="w-3 h-3" />
              });
            }
          });
        }

        // Remove duplicates and limit
        const uniqueSuggestions = newSuggestions
          .filter((item, index, self) => 
            index === self.findIndex(t => t.text === item.text)
          )
          .slice(0, 8);

        setSuggestions(uniqueSuggestions);
      } catch (error) {
        console.error('Error fetching smart suggestions:', error);
      } finally {
        setLoading(false);
      }
    };

    if (query.trim().length > 0) {
      fetchSuggestions();
    } else {
      setSuggestions([]);
      setLoading(false);
    }
  }, [query, activeTab]);

  if (loading || suggestions.length === 0) return null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'trending': return 'Trending';
      case 'recent': return 'Recently Added';
      case 'popular': return 'Popular';
      case 'related': return 'Related';
      default: return '';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'trending': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'recent': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'popular': return 'text-green-600 bg-green-50 border-green-200';
      case 'related': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return '';
    }
  };

  return (
    <div className="mb-6 p-4 border rounded-lg bg-gradient-to-r from-background to-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium">Smart Suggestions</h3>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <Badge
            key={index}
            variant="outline"
            className={`cursor-pointer hover:scale-105 transition-all duration-200 ${getTypeColor(suggestion.type)}`}
            onClick={() => onSuggestionClick(suggestion.text)}
          >
            <div className="flex items-center gap-1">
              {suggestion.icon}
              <span className="text-xs">{suggestion.text}</span>
            </div>
          </Badge>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        Based on {activeTab === 'all' ? 'all categories' : activeTab} trends and community activity
      </p>
    </div>
  );
};
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Clock, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface EntitySuggestion {
  id: string;
  entity_id: string;
  suggested_changes: any;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  context: string;
  created_at: string;
  reviewed_at?: string;
  applied_at?: string;
  admin_notes?: string;
  entity: {
    name: string;
    type: string;
    slug?: string;
  };
}

export const UserSuggestionHistory: React.FC = () => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<EntitySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchSuggestions = async () => {
      try {
        const { data, error } = await supabase
          .from('entity_suggestions')
          .select(`
            id,
            entity_id,
            suggested_changes,
            status,
            context,
            created_at,
            reviewed_at,
            applied_at,
            admin_notes,
            entities!inner (
              name,
              type,
              slug
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform the data to match our interface
        const transformedData = data.map(item => ({
          ...item,
          entity: Array.isArray(item.entities) ? item.entities[0] : item.entities
        }));

        setSuggestions(transformedData);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'approved':
      case 'applied':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
      case 'applied':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSuggestedChangesText = (changes: any) => {
    const changeKeys = Object.keys(changes);
    if (changeKeys.length === 0) return 'No specific changes';
    
    return changeKeys.map(key => {
      switch (key) {
        case 'name': return 'Name';
        case 'description': return 'Description';
        case 'address': return 'Address';
        case 'phone': return 'Phone';
        case 'website': return 'Website';
        case 'hours': return 'Business Hours';
        default: return key;
      }
    }).join(', ');
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Please sign in to view your suggestion history.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Loading your suggestions...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your Entity Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              You haven't made any suggestions yet. Help improve our database by suggesting edits to entities!
            </p>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <Card key={suggestion.id} className="border-l-4 border-l-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{suggestion.entity.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {suggestion.entity.type}
                          </Badge>
                          <Badge className={`text-xs ${getStatusColor(suggestion.status)}`}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(suggestion.status)}
                              {suggestion.status}
                            </span>
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground mb-2">
                          <strong>Changes suggested:</strong> {getSuggestedChangesText(suggestion.suggested_changes)}
                        </div>
                        
                        {suggestion.context && (
                          <div className="text-sm text-muted-foreground mb-2">
                            <strong>Context:</strong> {suggestion.context}
                          </div>
                        )}
                        
                        {suggestion.admin_notes && (
                          <div className="text-sm text-muted-foreground mb-2 p-2 bg-gray-50 rounded">
                            <strong>Admin Notes:</strong> {suggestion.admin_notes}
                          </div>
                        )}
                        
                        <div className="text-xs text-muted-foreground">
                          Submitted: {format(new Date(suggestion.created_at), 'MMM d, yyyy')}
                          {suggestion.reviewed_at && (
                            <span> • Reviewed: {format(new Date(suggestion.reviewed_at), 'MMM d, yyyy')}</span>
                          )}
                          {suggestion.applied_at && (
                            <span> • Applied: {format(new Date(suggestion.applied_at), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Navigate to entity page - you can implement this based on your routing
                            window.open(`/entity/${suggestion.entity.slug || suggestion.entity_id}?v=4`, '_blank');
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
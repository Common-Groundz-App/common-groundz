import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdminSuggestion {
  id: string;
  entity_id: string;
  user_id: string;
  suggested_changes: any;
  context: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  priority_score: number;
  user_is_owner: boolean;
  is_duplicate: boolean;
  is_business_closed: boolean;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  applied_at: string | null;
  entity: {
    id: string;
    name: string;
    type: string;
    image_url: string | null;
    description: string | null;
    metadata: any;
    website_url: string | null;
  } | null;
  user: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
  reviewer: {
    id: string;
    username: string | null;
  } | null;
}

export interface SuggestionStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  highPriority: number;
  businessOwner: number;
  duplicates: number;
  closedBusiness: number;
}

interface UseAdminSuggestionsOptions {
  pageSize?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useAdminSuggestions = (options: UseAdminSuggestionsOptions = {}) => {
  const { pageSize = 20, autoRefresh = false, refreshInterval = 30000 } = options;
  const { toast } = useToast();

  const [suggestions, setSuggestions] = useState<AdminSuggestion[]>([]);
  const [stats, setStats] = useState<SuggestionStats>({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    highPriority: 0,
    businessOwner: 0,
    duplicates: 0,
    closedBusiness: 0
  });
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchSuggestions = useCallback(async (page: number = currentPage) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('entity_suggestions')
        .select(`
          *,
          entity:entities!entity_suggestions_entity_id_fkey (
            id,
            name,
            type,
            image_url,
            description,
            metadata,
            website_url
          ),
          user:profiles!entity_suggestions_user_id_fkey (
            id,
            username,
            avatar_url
          ),
          reviewer:profiles!entity_suggestions_reviewed_by_fkey (
            id,
            username
          )
        `, { count: 'exact' });

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      if (priorityFilter === 'high') {
        query = query.gte('priority_score', 70);
      } else if (priorityFilter === 'medium') {
        query = query.gte('priority_score', 40).lt('priority_score', 70);
      } else if (priorityFilter === 'low') {
        query = query.lt('priority_score', 40);
      }

      // Note: entityTypeFilter will be handled in the frontend since we can't filter on joined tables directly

      if (searchQuery.trim()) {
        query = query.or(`entity.name.ilike.%${searchQuery}%,context.ilike.%${searchQuery}%`);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      // Filter by entity type on the frontend if needed
      let filteredData = data || [];
      if (entityTypeFilter !== 'all') {
        filteredData = filteredData.filter(s => s.entity?.type === entityTypeFilter);
      }
      
      setSuggestions(filteredData as unknown as AdminSuggestion[]);
      setTotalCount(count || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch suggestions',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, statusFilter, priorityFilter, entityTypeFilter, searchQuery, sortBy, sortOrder, toast]);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('entity_suggestions')
        .select('status, priority_score, user_is_owner, is_duplicate, is_business_closed');

      if (error) throw error;

      const stats = (data || []).reduce((acc, suggestion) => {
        switch (suggestion.status) {
          case 'pending':
            acc.totalPending++;
            break;
          case 'approved':
            acc.totalApproved++;
            break;
          case 'rejected':
            acc.totalRejected++;
            break;
        }

        if (suggestion.priority_score >= 70) acc.highPriority++;
        if (suggestion.user_is_owner) acc.businessOwner++;
        if (suggestion.is_duplicate) acc.duplicates++;
        if (suggestion.is_business_closed) acc.closedBusiness++;

        return acc;
      }, {
        totalPending: 0,
        totalApproved: 0,
        totalRejected: 0,
        highPriority: 0,
        businessOwner: 0,
        duplicates: 0,
        closedBusiness: 0
      });

      setStats(stats);
    } catch (error) {
      console.error('Error fetching suggestion stats:', error);
    }
  }, []);

  const updateSuggestionStatus = useCallback(async (
    suggestionId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string,
    applyChanges: boolean = false
  ) => {
    setProcessingIds(prev => new Set(prev).add(suggestionId));
    
    try {
      const updateData: any = {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString()
      };

      if (adminNotes) {
        updateData.admin_notes = adminNotes;
      }

      if (status === 'approved' && applyChanges) {
        updateData.applied_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('entity_suggestions')
        .update(updateData)
        .eq('id', suggestionId);

      if (error) throw error;

      // If approved and applying changes, update the entity
      if (status === 'approved' && applyChanges) {
        await applyChangesToEntity(suggestionId);
      }

      // Update local state
      setSuggestions(prev => prev.map(s => 
        s.id === suggestionId 
          ? { ...s, ...updateData }
          : s
      ));

      toast({
        title: 'Success',
        description: `Suggestion ${status} successfully`,
      });

      // Refresh stats
      await fetchStats();
    } catch (error) {
      console.error('Error updating suggestion:', error);
      toast({
        title: 'Error',
        description: `Failed to ${status} suggestion`,
        variant: 'destructive'
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(suggestionId);
        return newSet;
      });
    }
  }, [toast, fetchStats]);

  const applyChangesToEntity = useCallback(async (suggestionId: string) => {
    try {
      const suggestion = suggestions.find(s => s.id === suggestionId);
      if (!suggestion) throw new Error('Suggestion not found');

      const changes = suggestion.suggested_changes;
      const updateData: any = { updated_at: new Date().toISOString() };

      // Map suggested changes to entity fields
      if (changes.name) updateData.name = changes.name;
      if (changes.description) updateData.description = changes.description;
      if (changes.website) updateData.website_url = changes.website;
      
      // Handle metadata updates
      if (changes.phone || changes.hours) {
        const currentMetadata = suggestion.entity?.metadata || {};
        updateData.metadata = { ...currentMetadata };
        
        if (changes.phone) updateData.metadata.phone = changes.phone;
        if (changes.hours) updateData.metadata.hours = changes.hours;
      }

      const { error } = await supabase
        .from('entities')
        .update(updateData)
        .eq('id', suggestion.entity_id);

      if (error) throw error;

      toast({
        title: 'Changes Applied',
        description: 'Entity has been updated with suggested changes',
      });
    } catch (error) {
      console.error('Error applying changes to entity:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply changes to entity',
        variant: 'destructive'
      });
    }
  }, [suggestions, toast]);

  const bulkUpdateStatus = useCallback(async (
    suggestionIds: string[],
    status: 'approved' | 'rejected',
    adminNotes?: string
  ) => {
    try {
      const updateData: any = {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        updated_at: new Date().toISOString()
      };

      if (adminNotes) {
        updateData.admin_notes = adminNotes;
      }

      const { error } = await supabase
        .from('entity_suggestions')
        .update(updateData)
        .in('id', suggestionIds);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${suggestionIds.length} suggestions ${status} successfully`,
      });

      // Refresh data
      await fetchSuggestions();
      await fetchStats();
    } catch (error) {
      console.error('Error bulk updating suggestions:', error);
      toast({
        title: 'Error',
        description: 'Failed to update suggestions',
        variant: 'destructive'
      });
    }
  }, [toast, fetchSuggestions, fetchStats]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchSuggestions();
        fetchStats();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchSuggestions, fetchStats]);

  // Initial load
  useEffect(() => {
    fetchSuggestions();
    fetchStats();
  }, [fetchSuggestions, fetchStats]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    // Data
    suggestions,
    stats,
    totalCount,
    currentPage,
    totalPages,
    isLoading,
    processingIds,

    // Filters
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    entityTypeFilter,
    setEntityTypeFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,

    // Actions
    fetchSuggestions,
    fetchStats,
    updateSuggestionStatus,
    bulkUpdateStatus,
    applyChangesToEntity,
  };
};
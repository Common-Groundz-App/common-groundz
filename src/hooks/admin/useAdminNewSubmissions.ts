import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface NewSubmissionEntity {
  id: string;
  name: string;
  type: string;
  image_url: string | null;
  description: string | null;
  venue: string | null;
  approval_status: string;
  user_created: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  user?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface NewSubmissionStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  pendingDuplicates: number;
}

interface UseAdminNewSubmissionsOptions {
  pageSize?: number;
  autoRefresh?: boolean;
}

export const useAdminNewSubmissions = (options: UseAdminNewSubmissionsOptions = {}) => {
  const { pageSize = 20, autoRefresh = false } = options;
  const { toast } = useToast();
  
  const [submissions, setSubmissions] = useState<NewSubmissionEntity[]>([]);
  const [stats, setStats] = useState<NewSubmissionStats>({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    pendingDuplicates: 0
  });
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchSubmissions = async (page = 1) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('entities')
        .select(`
          id,
          name,
          type,
          image_url,
          description,
          venue,
          approval_status,
          user_created,
          created_by,
          created_at,
          updated_at,
          reviewed_by,
          reviewed_at,
          profiles:created_by (
            id,
            username,
            avatar_url
          )
        `)
        .eq('user_created', true)
        .eq('is_deleted', false);

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('approval_status', statusFilter);
      }
      
      if (typeFilter !== 'all') {
        query = query.eq('type', typeFilter as any);
      }
      
      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      // Get total count for pagination
      const { count } = await supabase
        .from('entities')
        .select('*', { count: 'exact', head: true })
        .eq('user_created', true)
        .eq('is_deleted', false);
      
      // Apply pagination and sorting
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      if (error) throw error;

      const formattedData = data.map(item => ({
        ...item,
        user: item.profiles ? {
          id: item.profiles.id,
          username: item.profiles.username,
          avatar_url: item.profiles.avatar_url
        } : undefined
      }));

      setSubmissions(formattedData);
      setTotalCount(count || 0);
      setTotalPages(Math.ceil((count || 0) / pageSize));
      setCurrentPage(page);
      
    } catch (error: any) {
      console.error('Error fetching submissions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch submissions',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get basic stats
      const { data: statsData, error } = await supabase
        .from('entities')
        .select('approval_status')
        .eq('user_created', true)
        .eq('is_deleted', false);

      if (error) throw error;

      const stats = statsData.reduce((acc, item) => {
        if (item.approval_status === 'pending') acc.totalPending++;
        else if (item.approval_status === 'approved') acc.totalApproved++;
        else if (item.approval_status === 'rejected') acc.totalRejected++;
        return acc;
      }, { totalPending: 0, totalApproved: 0, totalRejected: 0 });

      // Get pending duplicates count
      const { count: duplicatesCount } = await supabase
        .from('duplicate_entities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        ...stats,
        pendingDuplicates: duplicatesCount || 0
      });
      
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    }
  };

  const updateSubmissionStatus = async (
    submissionId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string
  ) => {
    setProcessingIds(prev => new Set(prev).add(submissionId));
    
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('entities')
        .update({
          approval_status: status,
          reviewed_by: user?.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Submission ${status} successfully`
      });

      // Refresh data
      await Promise.all([fetchSubmissions(currentPage), fetchStats()]);
      
    } catch (error: any) {
      console.error('Error updating submission:', error);
      toast({
        title: 'Error',
        description: `Failed to ${status} submission`,
        variant: 'destructive'
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(submissionId);
        return newSet;
      });
    }
  };

  const bulkUpdateStatus = async (submissionIds: string[], status: 'approved' | 'rejected') => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('entities')
        .update({
          approval_status: status,
          reviewed_by: user?.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .in('id', submissionIds);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${submissionIds.length} submissions ${status} successfully`
      });

      // Refresh data
      await Promise.all([fetchSubmissions(currentPage), fetchStats()]);
      
    } catch (error: any) {
      console.error('Error bulk updating submissions:', error);
      toast({
        title: 'Error',
        description: `Failed to ${status} submissions`,
        variant: 'destructive'
      });
    }
  };

  const runDuplicateDetection = async () => {
    try {
      const { data, error } = await supabase.rpc('detect_potential_duplicates', {
        similarity_threshold: 0.8
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Detected ${data} potential duplicates`
      });

      await fetchStats();
      
    } catch (error: any) {
      console.error('Error running duplicate detection:', error);
      toast({
        title: 'Error',
        description: 'Failed to run duplicate detection',
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    fetchSubmissions(1);
    fetchStats();
  }, [statusFilter, typeFilter, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchStats();
      }, 30000); // Refresh every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  return {
    submissions,
    stats,
    totalCount,
    currentPage,
    totalPages,
    isLoading,
    processingIds,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    fetchSubmissions,
    updateSubmissionStatus,
    bulkUpdateStatus,
    runDuplicateDetection
  };
};
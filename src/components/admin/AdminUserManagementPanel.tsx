import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Search, RefreshCw, Undo2, Trash2, AlertTriangle, UserX } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeletedUser {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
  deleted_at: string;
  created_at: string;
}

const SOFT_DELETE_RETENTION_DAYS = 30;

export const AdminUserManagementPanel = () => {
  const [users, setUsers] = useState<DeletedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Hard-delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<DeletedUser | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const totalPages = Math.ceil(total / pageSize);

  const fetchUsers = useCallback(async (targetPage = page) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-account', {
        body: {
          action: 'list-deleted',
          page: targetPage,
          page_size: pageSize,
          search: searchQuery || undefined,
        },
      });

      if (error) throw error;
      setUsers(data.data || []);
      setTotal(data.total || 0);
      setPage(targetPage);
    } catch (err: any) {
      console.error('Failed to fetch deleted users:', err);
      toast.error('Failed to load deleted accounts');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchQuery]);

  useEffect(() => {
    fetchUsers(1);
  }, [searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRecover = async (userId: string) => {
    setProcessingId(userId);
    try {
      const { error } = await supabase.functions.invoke('admin-manage-account', {
        body: { action: 'recover', user_id: userId },
      });
      if (error) throw error;
      toast.success('Account recovered successfully');
      fetchUsers();
    } catch (err: any) {
      console.error('Recovery failed:', err);
      toast.error('Failed to recover account');
    } finally {
      setProcessingId(null);
    }
  };

  const handleHardDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== 'DELETE') return;
    setProcessingId(deleteTarget.id);
    try {
      const { error } = await supabase.functions.invoke('admin-manage-account', {
        body: { action: 'hard-delete', user_id: deleteTarget.id },
      });
      if (error) throw error;
      toast.success('Account permanently deleted');
      setDeleteTarget(null);
      setDeleteConfirmText('');
      fetchUsers();
    } catch (err: any) {
      console.error('Hard delete failed:', err);
      toast.error('Failed to permanently delete account');
    } finally {
      setProcessingId(null);
    }
  };

  const getDaysRemaining = (deletedAt: string) => {
    const daysSince = differenceInDays(new Date(), new Date(deletedAt));
    return Math.max(0, SOFT_DELETE_RETENTION_DAYS - daysSince);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                User Account Management
              </CardTitle>
              <CardDescription>
                Manage soft-deleted accounts — recover or permanently delete
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchUsers()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deleted Accounts</CardTitle>
          <CardDescription>{total} deleted account{total !== 1 ? 's' : ''} found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserX className="h-8 w-8 mx-auto mb-2" />
              No deleted accounts found.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deleted</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const daysLeft = getDaysRemaining(u.deleted_at);
                    const isExpiring = daysLeft <= 7;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.username || 'No username'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {u.email || '—'}
                        </TableCell>
                        <TableCell>
                          {isExpiring ? (
                            <Badge variant="destructive">Expiring Soon</Badge>
                          ) : (
                            <Badge variant="secondary">Soft Deleted</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(u.deleted_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <span className={isExpiring ? 'text-destructive font-medium' : ''}>
                            {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRecover(u.id)}
                              disabled={processingId === u.id}
                            >
                              <Undo2 className="h-4 w-4 mr-1" />
                              Recover
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setDeleteTarget(u)}
                              disabled={processingId === u.id}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => page > 1 && fetchUsers(page - 1)}
                          className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const p = i + 1;
                        return (
                          <PaginationItem key={p}>
                            <PaginationLink
                              onClick={() => fetchUsers(p)}
                              isActive={page === p}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => page < totalPages && fetchUsers(page + 1)}
                          className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Hard-delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Permanently Delete Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The user <strong>{deleteTarget?.username || deleteTarget?.email}</strong> will be permanently removed from the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Type <strong>DELETE</strong> to confirm:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleHardDelete}
              disabled={deleteConfirmText !== 'DELETE' || processingId === deleteTarget?.id}
            >
              {processingId === deleteTarget?.id ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

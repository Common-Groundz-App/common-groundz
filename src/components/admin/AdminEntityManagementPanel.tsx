import React, { useState, useEffect, useCallback } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CreateEntityDialog } from "@/components/admin/CreateEntityDialog";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Edit, ArrowUpDown, ImagePlus, Calendar, Building2, Package, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Entity {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  created_at: string;
  parent_id?: string | null;
}

export const AdminEntityManagementPanel = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const { toast } = useToast();

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('entities')
        .select('id, name, type, image_url, created_at, parent_id')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntities(data || []);
    } catch (error) {
      console.error('Error fetching entities:', error);
      toast({
        title: 'Error',
        description: 'Failed to load entities',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const handleEntityCreated = () => {
    fetchEntities();
  };

  const columns: ColumnDef<Entity>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-semibold"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const entity = row.original;
        const hasParent = !!entity.parent_id;
        const isParent = parentEntityIds.includes(entity.id);
        
        return (
          <div className="flex items-center gap-2">
            {hasParent && <div className="w-4 border-l border-b border-muted-foreground/30 h-3 ml-2" />}
            <div className="flex items-center gap-2">
              {isParent ? (
                <Building2 className="h-4 w-4 text-blue-500" />
              ) : hasParent ? (
                <Package className="h-4 w-4 text-green-500" />
              ) : (
                <div className="w-4" />
              )}
              <div>
                <div className="font-medium">{entity.name}</div>
                {hasParent && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" />
                    Product under parent brand
                  </div>
                )}
                {isParent && (
                  <div className="text-xs text-blue-600 flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {getChildCount(entity.id)} products
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        const hasParent = !!row.original.parent_id;
        const isParent = parentEntityIds.includes(row.original.id);
        
        let variant: "default" | "secondary" | "outline" = "outline";
        if (isParent) variant = "default";
        else if (hasParent) variant = "secondary";
        
        return (
          <Badge variant={variant}>
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "image_url",
      header: "Image",
      cell: ({ row }) => {
        const imageUrl = row.getValue("image_url") as string | undefined;
        return (
          imageUrl ? (
            <div className="w-16 h-16 rounded-md overflow-hidden bg-muted">
              <img
                src={imageUrl}
                alt={row.original.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-16 h-16 rounded-md bg-muted text-muted-foreground">
              <ImagePlus className="h-6 w-6" />
            </div>
          )
        );
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-semibold"
        >
          Created At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("created_at") as string);
        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 opacity-70" />
            <span>{date.toLocaleDateString()}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button asChild variant="ghost" size="sm">
          <Link to={`/admin/entity/${row.original.id}`}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
      ),
    },
  ];

  // Add helper functions for parent-child relationships
  const getChildCount = (parentId: string): number => {
    return entities.filter(entity => entity.parent_id === parentId).length;
  };

  const parentEntityIds = entities
    .filter(entity => entities.some(child => child.parent_id === entity.id))
    .map(entity => entity.id);

  const filteredEntities = search
    ? entities.filter(entity =>
        entity.name.toLowerCase().includes(search.toLowerCase()) ||
        entity.type.toLowerCase().includes(search.toLowerCase())
      )
    : entities;

  const table = useReactTable({
    data: filteredEntities,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Entity Management</h1>
        <Button onClick={() => setOpenCreateDialog(true)}>
          Create Entity
        </Button>
      </div>

      <div className="mt-4">
        <Input
          type="search"
          placeholder="Search entities..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-6">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4">
                  Loading entities...
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4">
                  No entities found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>

      <CreateEntityDialog
        open={openCreateDialog}
        onOpenChange={setOpenCreateDialog}
        onEntityCreated={handleEntityCreated}
      />
    </div>
  );
};

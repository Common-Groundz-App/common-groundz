import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import AddEditRoutineModal from './AddEditRoutineModal';

interface RoutineCardProps {
  routine: any;
  onUpdate?: (data: {
    id: string;
    name?: string;
    description?: string;
    category?: string;
    frequency?: string;
    time_of_day?: string;
    steps?: any[];
  }) => void;
  onDelete?: (id: string) => void;
}

const categoryColors = {
  skincare: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
  haircare: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  workout: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  morning: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  night: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  custom: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
};

const RoutineCard = ({ routine, onUpdate, onDelete }: RoutineCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleSave = (data: any) => {
    if (onUpdate) {
      onUpdate({
        id: routine.id,
        name: data.name,
        description: data.description,
        category: data.category,
        frequency: data.frequency,
        time_of_day: data.time_of_day,
        steps: data.steps,
      });
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(routine.id);
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{routine.routine_name}</h3>
            <div className="flex gap-2 flex-wrap">
              <Badge className={categoryColors[routine.category as keyof typeof categoryColors]}>
                {routine.category}
              </Badge>
              <Badge variant="outline">{routine.frequency}</Badge>
              {routine.time_of_day && (
                <Badge variant="outline">{routine.time_of_day}</Badge>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowEditModal(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {routine.description && (
          <p className="text-sm text-muted-foreground mb-3">
            {routine.description}
          </p>
        )}

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span>{routine.steps?.length || 0} steps</span>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            {routine.steps && routine.steps.length > 0 ? (
              routine.steps.map((step: any, index: number) => (
                <div key={index} className="flex gap-3 p-3 bg-muted/50 rounded-md">
                  <span className="flex-shrink-0 font-semibold text-sm text-muted-foreground">
                    {index + 1}.
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{step.step_name}</p>
                    {step.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{step.notes}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">No steps added</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <AddEditRoutineModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        routine={routine}
        onSave={handleSave}
      />
    </>
  );
};

export default RoutineCard;

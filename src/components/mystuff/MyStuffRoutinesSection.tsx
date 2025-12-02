import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useUserRoutines } from '@/hooks/use-user-routines';
import RoutineCard from './RoutineCard';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import AddEditRoutineModal from './AddEditRoutineModal';

const MyStuffRoutinesSection = () => {
  const { routines, isLoading } = useUserRoutines();
  const [showAddModal, setShowAddModal] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Routine
        </Button>
      </div>

      {!routines || routines.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No routines yet</p>
          <Button onClick={() => setShowAddModal(true)} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Create Your First Routine
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {routines.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} />
          ))}
        </div>
      )}

      <AddEditRoutineModal open={showAddModal} onOpenChange={setShowAddModal} />
    </>
  );
};

export default MyStuffRoutinesSection;

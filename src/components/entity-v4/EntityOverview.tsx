import React from 'react';
import { Entity } from '@/services/recommendation/types';

interface EntityOverviewProps {
  entity: Entity | null;
}

export const EntityOverview: React.FC<EntityOverviewProps> = ({ entity }) => {
  if (!entity) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Overview</h2>
      <p className="text-gray-600">{entity.description || 'No description available.'}</p>
    </div>
  );
};
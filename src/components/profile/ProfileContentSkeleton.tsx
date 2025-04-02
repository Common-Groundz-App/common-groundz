
import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const ProfileContentSkeleton = () => {
  return (
    <div className="w-full bg-background pt-16 md:pt-20">
      <div className="w-full h-48 md:h-64 bg-gray-200 animate-pulse"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-24">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-full flex justify-center md:justify-start md:w-[300px] flex-shrink-0">
            <Card className="w-full max-w-[300px] md:w-full p-6">
              <div className="flex flex-col items-center">
                <Skeleton className="w-24 h-24 md:w-32 md:h-32 rounded-full mb-4" />
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-10 w-full mb-6" />
                <div className="space-y-2 w-full">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </Card>
          </div>
          <div className="flex-1 flex flex-col w-full">
            <div className="h-24 md:h-32"></div>
            <div className="bg-background pb-1 mb-2 border-b mt-4 md:mt-0">
              <div className="flex space-x-4">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileContentSkeleton;

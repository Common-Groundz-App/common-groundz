
import React from 'react';
import { CreatePostForm as OriginalCreatePostForm } from '@/components/feed/CreatePostForm';

export const CreatePostForm: React.FC<React.ComponentProps<typeof OriginalCreatePostForm>> = (props) => {
  return <OriginalCreatePostForm {...props} />;
};

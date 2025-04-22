
import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ContentType = 'post' | 'recommendation' | 'review' | null;

interface ContentViewerContextType {
  isOpen: boolean;
  contentType: ContentType;
  contentId: string | null;
  commentId: string | null;
  openContent: (type: ContentType, id: string, commentId?: string | null) => void;
  closeContent: () => void;
}

const ContentViewerContext = createContext<ContentViewerContextType | undefined>(undefined);

export const ContentViewerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [contentType, setContentType] = useState<ContentType>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const [commentId, setCommentId] = useState<string | null>(null);

  const openContent = (type: ContentType, id: string, commentId: string | null = null) => {
    setContentType(type);
    setContentId(id);
    setCommentId(commentId);
    setIsOpen(true);
  };

  const closeContent = () => {
    setIsOpen(false);
  };

  return (
    <ContentViewerContext.Provider
      value={{
        isOpen,
        contentType,
        contentId,
        commentId,
        openContent,
        closeContent
      }}
    >
      {children}
    </ContentViewerContext.Provider>
  );
};

export const useContentViewer = () => {
  const context = useContext(ContentViewerContext);
  if (context === undefined) {
    throw new Error('useContentViewer must be used within a ContentViewerProvider');
  }
  return context;
};


import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { renderHashtagLinks } from '@/utils/hashtagUtils';

export interface EditorProps {
  content?: any;
  value?: string;
  onChange: (json: any, html: any) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ content, value, onChange, placeholder, className }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON(), editor.getHTML());
    },
  });

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichTextDisplay({ content }: { content: any }) {
  const parsedContent = React.useMemo(() => {
    if (!content) return '';
    
    // Handle different content types
    if (typeof content === 'string') {
      return content;
    }
    
    // Handle structured content (Tiptap format)
    if (content.type === 'doc' && content.content) {
      return content;
    }
    
    // Handle other formats by converting to string
    return String(content);
  }, [content]);

  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: parsedContent,
    editable: false,
  });

  // If content is string and contains hashtags, render with safe linkification
  if (typeof parsedContent === 'string' && parsedContent.includes('#')) {
    const parts = renderHashtagLinks(parsedContent);
    return (
      <div className="prose prose-sm max-w-none text-foreground">
        {parts.map((part, index) => (
          <React.Fragment key={index}>{part}</React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none text-foreground">
      <EditorContent editor={editor} />
    </div>
  );
}

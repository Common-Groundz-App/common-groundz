import React from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  Heading2, 
  Heading3 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value?: string | object;
  onChange?: (json: object, html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  minimal?: boolean;
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('URL');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  return (
    <div className="flex flex-wrap gap-1 p-1 border-b mb-2">
      <Button
        variant="ghost"
        size="sm" 
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn(editor.isActive('bold') ? 'bg-muted' : '')}
        type="button"
      >
        <Bold size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm" 
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn(editor.isActive('italic') ? 'bg-muted' : '')}
        type="button"
      >
        <Italic size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm" 
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn(editor.isActive('heading', { level: 2 }) ? 'bg-muted' : '')}
        type="button"
      >
        <Heading2 size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm" 
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={cn(editor.isActive('heading', { level: 3 }) ? 'bg-muted' : '')}
        type="button"
      >
        <Heading3 size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm" 
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn(editor.isActive('bulletList') ? 'bg-muted' : '')}
        type="button"
      >
        <List size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm" 
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn(editor.isActive('orderedList') ? 'bg-muted' : '')}
        type="button"
      >
        <ListOrdered size={16} />
      </Button>
      <Button
        variant="ghost"
        size="sm" 
        onClick={addLink}
        className={cn(editor.isActive('link') ? 'bg-muted' : '')}
        type="button"
      >
        <LinkIcon size={16} />
      </Button>
    </div>
  );
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing...',
  editable = true,
  className,
  minimal = false
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    editable,
    onUpdate: ({ editor }) => {
      if (onChange) {
        const json = editor.getJSON();
        const html = editor.getHTML();
        onChange(json, html);
      }
    },
  });

  // Sync editor content when value prop changes (e.g., from draft restoration)
  React.useEffect(() => {
    if (editor && value !== undefined) {
      const currentContent = editor.getHTML();
      // Only update if content actually changed to avoid cursor jumps
      if (currentContent !== value) {
        editor.commands.setContent(value, false);
      }
    }
  }, [editor, value]);

  return (
    <div className={cn('border rounded-md', className)}>
      {editable && !minimal && <MenuBar editor={editor} />}
      <div className="p-3">
        <EditorContent editor={editor} className="prose prose-sm max-w-none" />
      </div>
    </div>
  );
}

export function RichTextDisplay({ content }: { content: any }) {
  const parsedContent = React.useMemo(() => {
    if (!content) return null;
    
    if (typeof content === 'string') {
      try {
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          return JSON.parse(content);
        }
        return content;
      } catch (e) {
        return content;
      }
    }
    
    return content;
  }, [content]);

  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: parsedContent,
    editable: false,
  });

  // Sync editor content when parsedContent changes
  React.useEffect(() => {
    if (editor && parsedContent !== undefined) {
      editor.commands.setContent(parsedContent, false);
    }
  }, [editor, parsedContent]);

  return (
    <div className="prose prose-sm max-w-none">
      <EditorContent editor={editor} />
    </div>
  );
}

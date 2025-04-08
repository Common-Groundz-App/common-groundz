
import { Comment } from '@/hooks/feed/types';
import CommentItem from './CommentItem';

interface CommentRepliesListProps {
  replies: Comment[];
  onEdit: (id: string, content: string) => Promise<any>;
  onDelete: (id: string) => Promise<boolean>;
  onReply: (content: string, parentId: string) => Promise<any>;
  onToggleReplies: (id: string) => void;
  setEditMode: (id: string, isEditing: boolean) => void;
}

const CommentRepliesList: React.FC<CommentRepliesListProps> = ({
  replies,
  onEdit,
  onDelete,
  onReply,
  onToggleReplies,
  setEditMode
}) => {
  if (!replies || replies.length === 0) return null;

  return (
    <div className="mt-2 ml-8 space-y-4">
      {replies.map(reply => (
        <CommentItem
          key={reply.id}
          comment={reply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReply={onReply}
          onToggleReplies={onToggleReplies}
          setEditMode={setEditMode}
          isReply={true}
        />
      ))}
    </div>
  );
};

export default CommentRepliesList;

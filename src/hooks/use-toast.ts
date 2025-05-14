
// We're importing from the shadcn component
import { useToast as useToastOriginal, toast } from "@/components/ui/use-toast";

// Re-export the toast function
export { toast };

// Re-export the hook
export const useToast = useToastOriginal;

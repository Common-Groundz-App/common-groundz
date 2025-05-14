
// Import from the correct location
import { useToast as useToastOriginal, toast } from "@/components/ui/use-toast";

// Re-export the toast function and hook
export { toast };
export const useToast = useToastOriginal;

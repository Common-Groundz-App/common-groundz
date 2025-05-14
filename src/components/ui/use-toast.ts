
import * as React from "react"
import {
  useToast,
  toast,
} from "@/components/ui/toast"

export {
  useToast,
  toast,
}

// Add types for toast variants
export type ToastVariant = "default" | "destructive" | "success" | "warning" | "info";

// Add types for toast action
export interface ToastAction {
  label: string;
  onClick: () => void;
  altText?: string;
}


import React from "react";
import { cn } from "@/lib/utils";
import { ImageWithFallback } from "./ImageWithFallback";

interface EntityPreviewCardProps {
  entity: {
    image_url?: string;
    name?: string;
    title?: string;
    brand?: string;
    website?: string;
    venue?: string;
    description?: string;
  };
  type: string;
  onChange: () => void;
}

export const EntityPreviewCard = ({
  entity,
  type,
  onChange,
}: EntityPreviewCardProps) => {
  if (!entity) return null;

  const showBrand =
    entity.brand ||
    entity.website ||
    entity.venue;

  console.log("EntityPreviewCard rendering with image_url:", entity.image_url);

  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{`Selected ${type}:`}</span>
        <button
          type="button"
          className="text-sm px-3 py-1 border rounded-md bg-white hover:bg-accent border-border shadow-sm transition"
          onClick={onChange}
        >
          Change
        </button>
      </div>
      <div className={cn(
        "flex w-full rounded-xl bg-white p-4 shadow-md border gap-4",
        "items-start"
      )}>
        {entity.image_url ? (
          <div className="flex-shrink-0">
            <ImageWithFallback
              src={entity.image_url}
              alt={entity.name || entity.title || "Preview"}
              className="w-20 h-20 object-cover rounded-lg border bg-gray-100"
              fallbackSrc="https://images.unsplash.com/photo-1495195134817-aeb325a55b65?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1776&q=80"
              onError={(e) => console.error("Image failed to load:", entity.image_url)}
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-muted-foreground text-sm font-semibold border">
            No image
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-base mb-1 text-gray-900 break-words whitespace-pre-line">
            {entity.name || entity.title}
          </div>
          {showBrand && (
            <div className="text-xs text-gray-500 font-medium mb-1 break-all">
              {entity.brand || entity.website || entity.venue}
            </div>
          )}
          {entity.description && (
            <div className="text-sm text-gray-700 leading-snug whitespace-pre-line break-words">
              {entity.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

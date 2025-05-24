import React from 'react';

interface ProductResultItemProps {
  product: {
    name: string;
    venue: string;
    description: string | null;
    image_url: string;
    api_source: string;
    api_ref: string;
    metadata: {
      price?: string;
      rating?: number;
      seller?: string;
      purchase_url: string;
      [key: string]: any;
    }
  };
  onClick: () => void;
}

export function ProductResultItem({ product, onClick }: ProductResultItemProps) {
  return (
    <a
      href={product.metadata.purchase_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-4 py-1.5 hover:bg-muted/30 transition-colors"
      onClick={onClick}
    >
      <img
        src={product.image_url}
        alt={product.name}
        className="h-8 w-8 rounded-full object-cover"
        onError={(e: any) => {
          e.target.onerror = null; // prevent infinite loop
          e.target.src = "https://via.placeholder.com/50"; // Placeholder image URL
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium truncate">{product.name}</p>
        </div>
        <div className="flex items-center text-xs text-muted-foreground">
          <span className="truncate">{product.venue}</span>
        </div>
        {product.metadata.price && (
          <div className="text-xs text-muted-foreground">
            Price: {product.metadata.price}
          </div>
        )}
      </div>
    </a>
  );
}

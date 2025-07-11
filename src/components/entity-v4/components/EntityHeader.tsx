
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator 
} from '@/components/ui/breadcrumb';
import { Star, ExternalLink, MapPin, Share2, Heart, Bookmark, Edit } from 'lucide-react';

export const EntityHeader = () => {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/brands">Brands</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Cosmix</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Brand Image */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Brand Logo</span>
            </div>
          </div>

          {/* Brand Info */}
          <div className="flex-1 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">Cosmix</h1>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Claimed
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm max-w-2xl">
                  Premium wellness brand focused on natural supplements and nutrition products. 
                  Committed to transparency and quality in every product we create.
                </p>
              </div>
            </div>

            {/* Ratings */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      className={`w-4 h-4 ${star <= 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                    />
                  ))}
                </div>
                <span className="font-medium">4.3</span>
                <span className="text-muted-foreground text-sm">from 2,847 reviews</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Circle score:</span>
                <span className="font-medium text-primary">4.6</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button className="flex-1 sm:flex-none">
                <Edit className="w-4 h-4 mr-2" />
                Write Review
              </Button>
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Visit Website
              </Button>
              <Button variant="outline">
                <MapPin className="w-4 h-4 mr-2" />
                Get Directions
              </Button>
              <Button variant="outline" size="icon">
                <Share2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Heart className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon">
                <Bookmark className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

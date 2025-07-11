
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Breadcrumb, 
  BreadcrumbList, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbSeparator, 
  BreadcrumbPage 
} from '@/components/ui/breadcrumb';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { ExternalLink, MapPin, Share, Heart, Bookmark, CheckCircle } from 'lucide-react';

export const EntityHeader = () => {
  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {/* Breadcrumb Navigation */}
        <Breadcrumb className="mb-4">
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
              <img 
                src="https://images.unsplash.com/photo-1649972904349-6e44c42644a7?w=150&h=150&fit=crop" 
                alt="Cosmix Brand" 
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          </div>

          {/* Brand Info */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Cosmix</h1>
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Claimed
              </Badge>
            </div>

            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              Premium nutrition and wellness brand offering plant-based supplements, protein powders, and health products. 
              Trusted by fitness enthusiasts and health-conscious individuals across India.
            </p>

            {/* Ratings */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <ConnectedRingsRating value={4.3} size="sm" />
                <span className="text-sm text-muted-foreground">4.3 from 2,847 reviews</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary-foreground">4.6</span>
                </div>
                <span className="text-sm font-medium">Circle Score</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button className="bg-brand-orange hover:bg-brand-orange/90">
                Write Review
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Visit Website
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Get Directions
              </Button>
              <Button variant="ghost" size="icon">
                <Share className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Heart className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Bookmark className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

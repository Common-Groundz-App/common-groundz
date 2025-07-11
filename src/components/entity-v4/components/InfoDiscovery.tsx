
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Mail, 
  Phone, 
  Globe, 
  Clock, 
  Edit3, 
  Star,
  ExternalLink
} from 'lucide-react';

export const InfoDiscovery = () => {
  return (
    <div className="space-y-6 sticky top-32">
      {/* Related Entities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Related Brands</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { name: 'Optimum Nutrition', rating: 4.5, category: 'Supplements' },
            { name: 'MuscleTech', rating: 4.2, category: 'Fitness' },
            { name: 'BSN', rating: 4.3, category: 'Sports Nutrition' }
          ].map((brand) => (
            <div key={brand.name} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                <span className="text-xs">{brand.name.substring(0, 2)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{brand.name}</h4>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs text-muted-foreground">{brand.rating}</span>
                </div>
                <Badge variant="secondary" className="text-xs mt-1">
                  {brand.category}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Business Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { day: 'Monday', hours: '10:00 AM - 7:00 PM' },
              { day: 'Tuesday', hours: '10:00 AM - 7:00 PM' },
              { day: 'Wednesday', hours: '10:00 AM - 7:00 PM' },
              { day: 'Thursday', hours: '10:00 AM - 7:00 PM' },
              { day: 'Friday', hours: '10:00 AM - 7:00 PM' },
              { day: 'Saturday', hours: '10:00 AM - 6:00 PM' },
              { day: 'Sunday', hours: 'Closed' }
            ].map((schedule) => (
              <div key={schedule.day} className="flex justify-between">
                <span className="text-muted-foreground">{schedule.day}</span>
                <span className={schedule.hours === 'Closed' ? 'text-red-600' : 'text-foreground'}>
                  {schedule.hours}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* About Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cosmix is a premium wellness brand dedicated to creating transparent, science-backed 
            nutrition products. Founded in 2019, we've been committed to helping people achieve 
            their health goals through high-quality supplements and personalized nutrition guidance.
          </p>
          <Button variant="outline" size="sm" className="mt-4 w-full">
            <Edit3 className="w-4 h-4 mr-2" />
            Suggest an Edit
          </Button>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Location</p>
              <p className="text-sm text-muted-foreground">Indiranagar, Bangalore</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">hello@cosmix.com</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Phone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Phone</p>
              <p className="text-sm text-muted-foreground">+91-9876543210</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Globe className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Website</p>
              <a 
                href="https://www.cosmix.com" 
                className="text-sm text-primary hover:underline flex items-center gap-1"
                target="_blank"
                rel="noopener noreferrer"
              >
                www.cosmix.com
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


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
        <CardContent>
          <div className="space-y-3">
            {['HealthifyMe', 'MyProtein', 'Optimum Nutrition'].map((brand, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                <div className="w-10 h-10 bg-muted rounded-lg"></div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{brand}</p>
                  <p className="text-xs text-muted-foreground">Nutrition Brand</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Monday - Saturday</span>
              <span className="font-medium">10 AM - 7 PM</span>
            </div>
            <div className="flex justify-between">
              <span>Sunday</span>
              <span className="text-muted-foreground">Closed</span>
            </div>
            <Badge variant="secondary" className="mt-2">
              Currently Open
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Cosmix is dedicated to providing premium plant-based nutrition products. 
            Founded in 2018, we focus on creating clean, effective supplements for 
            modern lifestyles.
          </p>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Suggest an Edit
          </Button>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Location</p>
                <p className="text-sm text-muted-foreground">Indiranagar, Bangalore</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">hello@cosmix.com</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">+91-9876543210</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Website</p>
                <p className="text-sm text-muted-foreground">www.cosmix.com</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

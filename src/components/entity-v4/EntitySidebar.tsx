
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Phone, Globe, Star, Users } from "lucide-react";
import { Entity } from '@/services/recommendation/types';

interface EntitySidebarProps {
  entity: Entity;
  isFollowing?: boolean;
  followerCount?: number;
  onFollowToggle?: () => void;
}

export const EntitySidebar: React.FC<EntitySidebarProps> = ({ 
  entity, 
  isFollowing = false,
  followerCount = 0,
  onFollowToggle
}) => {
  const businessHours = [
    { day: 'Monday', hours: '9:00 AM - 6:00 PM' },
    { day: 'Tuesday', hours: '9:00 AM - 6:00 PM' },
    { day: 'Wednesday', hours: '9:00 AM - 6:00 PM' },
    { day: 'Thursday', hours: '9:00 AM - 6:00 PM' },
    { day: 'Friday', hours: '9:00 AM - 6:00 PM' },
    { day: 'Saturday', hours: '10:00 AM - 4:00 PM' },
    { day: 'Sunday', hours: 'Closed' }
  ];

  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayHours = businessHours.find(h => h.day === currentDay);

  return (
    <div className="space-y-6 sticky top-8">
      {/* Follow/Unfollow Button */}
      <Card>
        <CardContent className="p-4">
          <Button 
            variant={isFollowing ? "outline" : "default"} 
            className="w-full"
            onClick={onFollowToggle}
          >
            <Users className="w-4 h-4 mr-2" />
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
          {followerCount > 0 && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              {followerCount.toLocaleString()} followers
            </p>
          )}
        </CardContent>
      </Card>

      {/* Business Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Business Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">Address</p>
              <p className="text-sm text-muted-foreground">
                123 Health Street, Mumbai, Maharashtra 400001
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="w-4 h-4 mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">Phone</p>
              <p className="text-sm text-muted-foreground">+91 98765 43210</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Globe className="w-4 h-4 mt-1 text-muted-foreground" />
            <div>
              <p className="font-medium">Website</p>
              <a href="#" className="text-sm text-blue-600 hover:underline">
                www.{entity.name.toLowerCase().replace(/\s+/g, '')}.com
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 mt-1 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">Hours</p>
              {todayHours && (
                <p className="text-sm">
                  <span className="font-medium">Today:</span> {todayHours.hours}
                </p>
              )}
              <details className="mt-2">
                <summary className="text-sm text-blue-600 cursor-pointer hover:underline">
                  See all hours
                </summary>
                <div className="mt-2 space-y-1">
                  {businessHours.map(({ day, hours }) => (
                    <div key={day} className="flex justify-between text-xs">
                      <span className={day === currentDay ? 'font-medium' : ''}>{day}</span>
                      <span className={day === currentDay ? 'font-medium' : ''}>{hours}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Founded</span>
            <Badge variant="outline">2018</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Employees</span>
            <Badge variant="outline">50-100</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Industry</span>
            <Badge variant="outline">Health & Wellness</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Meet the Founder */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <img 
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop" 
              alt="Founder" 
              className="w-16 h-16 rounded-full object-cover" 
            />
            <div>
              <h3 className="font-semibold text-gray-900">Meet the Founder</h3>
              <p className="text-blue-600 font-medium">Rohit Sharma</p>
              <p className="text-sm text-gray-600">CEO & Co-founder</p>
              <p className="text-sm text-gray-500 mt-1">15+ years in health & wellness industry</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Related Entities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">You Might Also Like</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "HealthifyMe", rating: 4.2, category: "Health Apps" },
            { name: "MyFitnessPal", rating: 4.0, category: "Fitness Apps" },
            { name: "Optimum Nutrition", rating: 4.5, category: "Supplements" }
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                {item.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm">{item.name}</h4>
                <p className="text-xs text-muted-foreground">{item.category}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-xs">{item.rating}</span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

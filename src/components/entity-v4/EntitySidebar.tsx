
import React from 'react';
import { Clock, MapPin, Mail, Phone, Globe, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EntitySidebarProps {
  entityData: {
    location: string;
    email: string;
    phone: string;
    website: string;
  };
}

export const EntitySidebar: React.FC<EntitySidebarProps> = ({ entityData }) => {
  // Related Entities - TODO: Make this dynamic
  const relatedEntities = [{
    name: "HealthifyMe",
    rating: 4.2,
    category: "Health Apps",
    image: "https://images.unsplash.com/photo-1500673922987-e212871fec22?w=100&h=100&fit=crop"
  }, {
    name: "MyFitnessPal",
    rating: 4.0,
    category: "Fitness Apps",
    image: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=100&h=100&fit=crop"
  }, {
    name: "Optimum Nutrition",
    rating: 4.5,
    category: "Supplements",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=100&h=100&fit=crop"
  }];

  return (
    <div className="space-y-6 sticky top-8">
      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5" />
            Business Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Monday - Friday</span>
              <span className="text-green-600 font-medium">10 AM - 7 PM</span>
            </div>
            <div className="flex justify-between">
              <span>Saturday</span>
              <span className="text-green-600 font-medium">10 AM - 6 PM</span>
            </div>
            <div className="flex justify-between">
              <span>Sunday</span>
              <span className="text-red-600 font-medium">Closed</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{entityData.location}</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{entityData.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{entityData.phone}</span>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{entityData.website}</span>
          </div>
        </CardContent>
      </Card>

      {/* About Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Cosmix is committed to delivering the highest quality health and wellness products. 
            Our team of experts ensures that every product meets rigorous quality standards 
            and is backed by scientific research.
          </p>
          <Button variant="outline" size="sm" className="w-full">
            Suggest an Edit
          </Button>
        </CardContent>
      </Card>

      {/* Related Entities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Related Brands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {relatedEntities.map((entity, index) => (
              <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <img src={entity.image} alt={entity.name} className="w-8 h-8 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{entity.name}</h4>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs">{entity.rating}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Talk to Circle */}
      <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-4 text-center">
          <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900 mb-2">Talk to Someone in Your Circle</h3>
          <p className="text-sm text-gray-600 mb-3">Connect with people who have experience with Cosmix</p>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
            Find Connections
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

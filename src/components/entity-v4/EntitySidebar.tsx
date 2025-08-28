
import React from 'react';
import { Clock, MapPin, Mail, Phone, Globe, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Entity } from '@/services/recommendation/types';
import { EntitySuggestionButton } from './EntitySuggestionButton';
import { 
  shouldShowBusinessHours, 
  shouldShowContactInfo, 
  extractBusinessHours, 
  extractContactInfo, 
  formatBusinessHours 
} from '@/utils/entitySidebarLogic';

interface EntitySidebarProps {
  entity: Entity;
}

export const EntitySidebar: React.FC<EntitySidebarProps> = ({ entity }) => {
  const contactInfo = extractContactInfo(entity);
  const businessHours = extractBusinessHours(entity);
  const formattedHours = formatBusinessHours(businessHours);
  
  // Related Entities - TODO: Make this dynamic later
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
      {/* Business Hours - Only show for relevant entity types with data */}
      {shouldShowBusinessHours(entity) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" />
              Business Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {formattedHours.map(({ day, hours, isOpen }) => (
                <div key={day} className="grid grid-cols-[80px_1fr] gap-3">
                  <span className="font-medium">{day}</span>
                  <div className="space-y-1">
                    {hours.map((timeRange, index) => (
                      <div 
                        key={index}
                        className={isOpen ? "text-green-600 font-medium" : "text-red-600 font-medium"}
                      >
                        {timeRange}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Information - Only show if any contact info is available */}
      {shouldShowContactInfo(entity) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contactInfo.location && (
              <div className="flex items-center gap-3 min-w-0">
                <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm break-words min-w-0">{contactInfo.location}</span>
              </div>
            )}
            {contactInfo.email && (
              <div className="flex items-center gap-3 min-w-0">
                <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm break-all min-w-0">{contactInfo.email}</span>
              </div>
            )}
            {contactInfo.phone && (
              <div className="flex items-center gap-3 min-w-0">
                <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm break-all min-w-0">{contactInfo.phone}</span>
              </div>
            )}
            {contactInfo.website && (
              <div className="flex items-center gap-3 min-w-0">
                <Globe className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm break-all min-w-0">{contactInfo.website}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* About Section - Always show */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {entity.description || "No description available for this entity. Help improve our database by suggesting an edit."}
          </p>
          <EntitySuggestionButton entity={entity} />
        </CardContent>
      </Card>

      {/* Related Entities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Related Brands</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {relatedEntities.map((relatedEntity, index) => (
              <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <img src={relatedEntity.image} alt={relatedEntity.name} className="w-8 h-8 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{relatedEntity.name}</h4>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs">{relatedEntity.rating}</span>
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
          <p className="text-sm text-gray-600 mb-3">Connect with people who have experience with {entity.name}</p>
          <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
            Find Connections
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

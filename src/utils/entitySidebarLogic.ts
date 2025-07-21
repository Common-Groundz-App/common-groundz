
import { Entity, EntityType } from '@/services/recommendation/types';

export interface BusinessHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
}

export const shouldShowBusinessHours = (entity: Entity): boolean => {
  // Only show for places and food establishments
  if (entity.type !== EntityType.Place && entity.type !== EntityType.Food) {
    return false;
  }
  
  // Check if business hours data exists in metadata
  const businessHours = extractBusinessHours(entity);
  return Object.values(businessHours).some(hours => hours && hours.trim() !== '');
};

export const shouldShowContactInfo = (entity: Entity): boolean => {
  const contactInfo = extractContactInfo(entity);
  return !!(contactInfo.email || contactInfo.phone || contactInfo.website || contactInfo.location);
};

export const extractBusinessHours = (entity: Entity): BusinessHours => {
  if (!entity.metadata) return {};
  
  // Try different possible metadata structures
  const businessHours = entity.metadata.business_hours || entity.metadata.hours || {};
  
  return {
    monday: businessHours.monday || businessHours.mon,
    tuesday: businessHours.tuesday || businessHours.tue,
    wednesday: businessHours.wednesday || businessHours.wed,
    thursday: businessHours.thursday || businessHours.thu,
    friday: businessHours.friday || businessHours.fri,
    saturday: businessHours.saturday || businessHours.sat,
    sunday: businessHours.sunday || businessHours.sun,
  };
};

export const extractContactInfo = (entity: Entity): ContactInfo => {
  const metadata = entity.metadata || {};
  const contact = metadata.contact || {};
  
  return {
    email: contact.email || metadata.email,
    phone: contact.phone || metadata.phone,
    website: entity.website_url,
    location: entity.venue,
  };
};

export const formatBusinessHours = (hours: BusinessHours): Array<{ day: string; hours: string; isOpen: boolean }> => {
  const dayNames = {
    monday: 'Monday',
    tuesday: 'Tuesday', 
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };
  
  return Object.entries(dayNames).map(([key, dayName]) => {
    const dayHours = hours[key as keyof BusinessHours];
    const isOpen = dayHours && dayHours.toLowerCase() !== 'closed';
    
    return {
      day: dayName,
      hours: dayHours || 'Closed',
      isOpen: !!isOpen,
    };
  });
};

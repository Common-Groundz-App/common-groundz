
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
  
  // Check if business hours data exists in any format
  const businessHours = extractBusinessHours(entity);
  return Object.values(businessHours).some(hours => hours && hours.trim() !== '');
};

export const shouldShowContactInfo = (entity: Entity): boolean => {
  const contactInfo = extractContactInfo(entity);
  return !!(contactInfo.email || contactInfo.phone || contactInfo.website || contactInfo.location);
};

export const extractBusinessHours = (entity: Entity): BusinessHours => {
  if (!entity.metadata && !entity.specifications) return {};
  
  // First, try to get from Google Places API format (specifications.hours)
  if (entity.specifications?.hours) {
    const googleHours = entity.specifications.hours;
    
    // Handle Google Places opening_hours format with weekday_text
    if (googleHours.weekday_text && Array.isArray(googleHours.weekday_text)) {
      const hours: BusinessHours = {};
      
      googleHours.weekday_text.forEach((dayText: string) => {
        const lowerDayText = dayText.toLowerCase();
        if (lowerDayText.includes('monday')) {
          hours.monday = dayText.split(': ')[1] || dayText;
        } else if (lowerDayText.includes('tuesday')) {
          hours.tuesday = dayText.split(': ')[1] || dayText;
        } else if (lowerDayText.includes('wednesday')) {
          hours.wednesday = dayText.split(': ')[1] || dayText;
        } else if (lowerDayText.includes('thursday')) {
          hours.thursday = dayText.split(': ')[1] || dayText;
        } else if (lowerDayText.includes('friday')) {
          hours.friday = dayText.split(': ')[1] || dayText;
        } else if (lowerDayText.includes('saturday')) {
          hours.saturday = dayText.split(': ')[1] || dayText;
        } else if (lowerDayText.includes('sunday')) {
          hours.sunday = dayText.split(': ')[1] || dayText;
        }
      });
      
      if (Object.values(hours).some(h => h)) {
        return hours;
      }
    }
    
    // Handle direct hours object in specifications
    if (typeof googleHours === 'object' && !Array.isArray(googleHours)) {
      const hours: BusinessHours = {
        monday: googleHours.monday || googleHours.mon,
        tuesday: googleHours.tuesday || googleHours.tue,
        wednesday: googleHours.wednesday || googleHours.wed,
        thursday: googleHours.thursday || googleHours.thu,
        friday: googleHours.friday || googleHours.fri,
        saturday: googleHours.saturday || googleHours.sat,
        sunday: googleHours.sunday || googleHours.sun,
      };
      
      if (Object.values(hours).some(h => h)) {
        return hours;
      }
    }
  }
  
  // Fallback to metadata format (for manually entered data)
  const businessHours = entity.metadata?.business_hours || entity.metadata?.hours || {};
  
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
  const specifications = entity.specifications || {};
  const contact = metadata.contact || {};
  
  return {
    email: contact.email || metadata.email || specifications.email,
    phone: contact.phone || metadata.phone || specifications.phone,
    website: entity.website_url || specifications.website,
    location: entity.venue || specifications.address,
  };
};

export const formatBusinessHours = (hours: BusinessHours): Array<{ day: string; hours: string[]; isOpen: boolean }> => {
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
    const isOpen = dayHours && dayHours.toLowerCase() !== 'closed' && !dayHours.toLowerCase().includes('closed');
    
    // Split multiple time ranges by comma and clean them up
    const hoursArray = dayHours 
      ? dayHours.split(',').map(time => time.trim()).filter(time => time)
      : ['Closed'];
    
    return {
      day: dayName,
      hours: hoursArray,
      isOpen: !!isOpen,
    };
  });
};

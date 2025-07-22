import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BusinessHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

interface BusinessHoursEditorProps {
  value: BusinessHours;
  onChange: (hours: BusinessHours) => void;
  disabled?: boolean;
}

const days = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

const presets = [
  { label: 'Closed', value: 'Closed' },
  { label: '24/7', value: '24 hours' },
  { label: 'By appointment', value: 'By appointment' },
  { label: '9:00 AM - 5:00 PM', value: '9:00 AM - 5:00 PM' },
  { label: '10:00 AM - 6:00 PM', value: '10:00 AM - 6:00 PM' },
  { label: '8:00 AM - 8:00 PM', value: '8:00 AM - 8:00 PM' },
  { label: '12:00 PM - 10:00 PM', value: '12:00 PM - 10:00 PM' },
];

export const BusinessHoursEditor: React.FC<BusinessHoursEditorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const handleDayChange = (day: string, hours: string) => {
    onChange({
      ...value,
      [day]: hours
    });
  };

  const applyToAllDays = (hours: string) => {
    const newHours: BusinessHours = {};
    days.forEach(day => {
      newHours[day.key] = hours;
    });
    onChange(newHours);
  };

  const applyToWeekdays = (hours: string) => {
    onChange({
      ...value,
      monday: hours,
      tuesday: hours,
      wednesday: hours,
      thursday: hours,
      friday: hours,
    });
  };

  const applyToWeekends = (hours: string) => {
    onChange({
      ...value,
      saturday: hours,
      sunday: hours,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Business Hours</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quick Actions</Label>
          <div className="flex flex-wrap gap-2">
            {presets.map(preset => (
              <Button
                key={preset.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyToAllDays(preset.value)}
                disabled={disabled}
                className="text-xs"
              >
                All: {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyToWeekdays('9:00 AM - 5:00 PM')}
              disabled={disabled}
              className="text-xs"
            >
              Weekdays: 9-5
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyToWeekends('10:00 AM - 6:00 PM')}
              disabled={disabled}
              className="text-xs"
            >
              Weekends: 10-6
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyToWeekends('Closed')}
              disabled={disabled}
              className="text-xs"
            >
              Weekends: Closed
            </Button>
          </div>
        </div>

        {/* Individual Days */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Hours by Day</Label>
          {days.map(day => (
            <div key={day.key} className="flex items-center gap-4">
              <Label className="w-20 text-sm">{day.label}</Label>
              <div className="flex-1 flex gap-2">
                <Input
                  value={value[day.key] || ''}
                  onChange={(e) => handleDayChange(day.key, e.target.value)}
                  placeholder="e.g., 9:00 AM - 5:00 PM, Closed, 24 hours"
                  disabled={disabled}
                  className="text-sm"
                />
                <Select
                  value=""
                  onValueChange={(preset) => handleDayChange(day.key, preset)}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map(preset => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        {/* Clear All */}
        <div className="pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({})}
            disabled={disabled}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Clear All Hours
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
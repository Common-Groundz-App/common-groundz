
import React from 'react';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateSelectorProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
}

const DateSelector = ({ value, onChange }: DateSelectorProps) => {
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  
  const timePeriods = [
    { label: "Today", value: new Date() },
    { label: "Yesterday", value: new Date(Date.now() - 86400000) },
    { label: "Last week", value: new Date(Date.now() - 7 * 86400000) },
    { label: "Last month", value: new Date(Date.now() - 30 * 86400000) },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 mb-2">
        {timePeriods.map((period) => (
          <Button
            key={period.label}
            type="button"
            variant="outline"
            className={cn(
              "h-auto py-2 px-3 transition-all duration-200",
              value && format(value, 'yyyy-MM-dd') === format(period.value, 'yyyy-MM-dd')
                ? "bg-brand-orange/10 border-brand-orange/30 text-brand-orange font-medium"
                : "hover:bg-accent/30"
            )}
            onClick={() => {
              onChange(period.value);
            }}
          >
            {period.label}
          </Button>
        ))}
      </div>
      
      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-start text-left font-normal transition-all duration-200",
              "border-brand-orange/30 focus-visible:ring-brand-orange/30",
              !value && "text-muted-foreground",
              value && "bg-brand-orange/5"
            )}
          >
            <Calendar className="mr-2 h-4 w-4 text-brand-orange" />
            {value ? format(value, "PPP") : "Or pick a specific date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50 pointer-events-auto" align="start">
          <CalendarComponent
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange(date);
              setDatePickerOpen(false);
            }}
            disabled={(date) => date > new Date()}
            initialFocus
            className="p-3 pointer-events-auto border rounded-md shadow-md"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateSelector;

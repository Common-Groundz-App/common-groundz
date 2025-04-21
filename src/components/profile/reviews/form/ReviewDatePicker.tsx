
import React from 'react';
import { Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

interface ReviewDatePickerProps {
  control: any;
  datePickerOpen: boolean;
  setDatePickerOpen: (open: boolean) => void;
}

const ReviewDatePicker = ({ control, datePickerOpen, setDatePickerOpen }: ReviewDatePickerProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="experience_date">When did you experience this? (optional)</Label>
      <Controller
        name="experience_date"
        control={control}
        render={({ field }) => (
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full justify-start text-left font-normal border-brand-orange/30 focus:ring-brand-orange/30",
                  !field.value && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-brand-orange" />
                {field.value ? format(field.value, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="start">
              <Calendar
                mode="single"
                selected={field.value}
                onSelect={(date) => {
                  field.onChange(date);
                  setDatePickerOpen(false);
                }}
                disabled={(date) => date > new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}
      />
    </div>
  );
};

export default ReviewDatePicker;

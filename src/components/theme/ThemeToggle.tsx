
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun, Laptop } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Theme</h3>
      </div>
      
      <RadioGroup
        value={theme}
        onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
        className="grid grid-cols-3 gap-4"
      >
        <div>
          <RadioGroupItem
            value="light"
            id="light"
            className="peer sr-only"
          />
          <Label
            htmlFor="light"
            className="flex flex-col items-center justify-between rounded-md border-2 border-muted p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
          >
            <Sun className="mb-3 h-6 w-6" />
            Light
          </Label>
        </div>
        
        <div>
          <RadioGroupItem
            value="dark"
            id="dark"
            className="peer sr-only"
          />
          <Label
            htmlFor="dark"
            className="flex flex-col items-center justify-between rounded-md border-2 border-muted p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
          >
            <Moon className="mb-3 h-6 w-6" />
            Dark
          </Label>
        </div>
        
        <div>
          <RadioGroupItem
            value="system"
            id="system"
            className="peer sr-only"
          />
          <Label
            htmlFor="system"
            className="flex flex-col items-center justify-between rounded-md border-2 border-muted p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
          >
            <Laptop className="mb-3 h-6 w-6" />
            System
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}

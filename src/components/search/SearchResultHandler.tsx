import React from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { BookOpen, Film, MapPin, Package, Utensils } from "lucide-react";

interface EntityCategory {
  name: string;
  icon: React.ReactNode;
  description: string;
}

const entityCategories: Record<"book" | "movie" | "place" | "product" | "food", EntityCategory> = {
  book: {
    name: "Books",
    icon: <BookOpen className="h-4 w-4" />,
    description: "Literature, novels, non-fiction"
  },
  movie: {
    name: "Movies & TV",
    icon: <Film className="h-4 w-4" />,
    description: "Films, series, documentaries"
  },
  place: {
    name: "Places",
    icon: <MapPin className="h-4 w-4" />,
    description: "Restaurants, venues, locations"
  },
  product: {
    name: "Products",
    icon: <Package className="h-4 w-4" />,
    description: "Items, gadgets, tools"
  },
  food: {
    name: "Food & Drinks",
    icon: <Utensils className="h-4 w-4" />,
    description: "Dishes, beverages, recipes"
  }
};

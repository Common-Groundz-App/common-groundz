
import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RecommendationCategory, RecommendationVisibility } from '@/services/recommendationService';
import { useToast } from '@/hooks/use-toast';
import { Image, Upload, Star } from 'lucide-react';

// Define form schema
const formSchema = z.object({
  title: z.string().min(2, { message: 'Title is required' }).max(100),
  venue: z.string().optional(),
  description: z.string().optional(),
  rating: z.number().min(0).max(5),
  category: z.enum(['food', 'movie', 'product', 'book', 'place']),
  visibility: z.enum(['public', 'private', 'circle_only']),
});

type FormValues = z.infer<typeof formSchema>;

interface RecommendationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues & { image_url: string | null }) => Promise<void>;
  onImageUpload: (file: File) => Promise<string | null>;
}

const categories = [
  { value: 'food', label: 'Food' },
  { value: 'movie', label: 'Movie' },
  { value: 'product', label: 'Product' },
  { value: 'book', label: 'Book' },
  { value: 'place', label: 'Place' },
];

const visibilityOptions = [
  { value: 'public', label: 'Public (Everyone)' },
  { value: 'private', label: 'Private (Only me)' },
  { value: 'circle_only', label: 'Circle Only (My followers)' },
];

export const RecommendationForm = ({
  isOpen,
  onClose,
  onSubmit,
  onImageUpload,
}: RecommendationFormProps) => {
  const { toast } = useToast();
  const [selectedRating, setSelectedRating] = useState<number>(4);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      venue: '',
      description: '',
      rating: 4,
      category: 'food' as RecommendationCategory,
      visibility: 'public' as RecommendationVisibility,
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await onImageUpload(file);
      if (url) {
        setImageUrl(url);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFormSubmit = async (values: FormValues) => {
    try {
      await onSubmit({ ...values, image_url: imageUrl });
      form.reset();
      setImageUrl(null);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Form submission failed',
        description: 'There was an error submitting your recommendation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add New Recommendation</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter title..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="venue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue / Source</FormLabel>
                  <FormControl>
                    <Input placeholder="Where can this be found?" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Why do you recommend this?"
                      className="min-h-[100px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating</FormLabel>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Button
                          key={star}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRating(star);
                            field.onChange(star);
                          }}
                          className="p-0 h-8 w-8"
                        >
                          <Star
                            className={`h-6 w-6 ${
                              star <= selectedRating
                                ? 'fill-brand-orange text-brand-orange'
                                : 'text-gray-300'
                            }`}
                          />
                        </Button>
                      ))}
                      <span className="ml-2 text-sm">{selectedRating} of 5</span>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {visibilityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Image</FormLabel>
              <div className="grid gap-4">
                {imageUrl && (
                  <div className="relative rounded-md overflow-hidden h-[150px] bg-gray-100">
                    <img
                      src={imageUrl}
                      alt="Recommendation preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setImageUrl(null)}
                    >
                      Remove
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <label
                    htmlFor="image-upload"
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors"
                  >
                    <Upload size={16} />
                    <span>{imageUrl ? 'Change Image' : 'Upload Image'}</span>
                    <input
                      id="image-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={isUploading}
                    />
                  </label>
                  {isUploading && <span className="text-sm text-gray-500">Uploading...</span>}
                </div>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="mt-4">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting || isUploading} className="mt-4">
                {form.formState.isSubmitting ? 'Submitting...' : 'Add Recommendation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default RecommendationForm;

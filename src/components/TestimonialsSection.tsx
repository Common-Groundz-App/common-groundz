
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const testimonials = [
  {
    quote: "I've discovered so many amazing books through recommendations from my friends. It's so much better than random online reviews!",
    name: "Alex Johnson",
    role: "Book Lover",
    avatar: "AJ"
  },
  {
    quote: "I used to spend hours trying to find good movies to watch. Now I just check what my film buff friends recommend!",
    name: "Sam Chen",
    role: "Movie Enthusiast",
    avatar: "SC"
  },
  {
    quote: "My skincare routine has completely transformed thanks to honest product recommendations from people I actually trust.",
    name: "Taylor Kim",
    role: "Beauty Expert",
    avatar: "TK"
  },
  {
    quote: "No more endless searching for good restaurants when traveling. I just ask my foodie friends on RecommendIO!",
    name: "Jordan Lee",
    role: "Food Blogger",
    avatar: "JL"
  }
];

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">What Our Users Say</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands of people who discover recommendations from their trusted circle.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard 
              key={index}
              quote={testimonial.quote}
              name={testimonial.name}
              role={testimonial.role}
              avatar={testimonial.avatar}
              delay={index * 0.1}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

interface TestimonialCardProps {
  quote: string;
  name: string;
  role: string;
  avatar: string;
  delay?: number;
}

const TestimonialCard = ({ quote, name, role, avatar, delay = 0 }: TestimonialCardProps) => {
  return (
    <Card className="border-none shadow-sm card-hover animate-fade-in" style={{ animationDelay: `${delay}s` }}>
      <CardContent className="p-6">
        <div className="mb-4">
          <svg width="30" height="24" viewBox="0 0 30 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5 6H18L13.5 18H9L13.5 6Z" fill="currentColor" fillOpacity="0.2"/>
            <path d="M25.5 6H30L25.5 18H21L25.5 6Z" fill="currentColor" fillOpacity="0.2"/>
          </svg>
        </div>
        <p className="text-foreground mb-6">{quote}</p>
        <div className="flex items-center">
          <Avatar className="mr-3">
            <AvatarImage src="" alt={name} />
            <AvatarFallback className="bg-primary/10 text-primary">{avatar}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-sm text-muted-foreground">{role}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TestimonialsSection;

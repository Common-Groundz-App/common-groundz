
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { Search, Filter, Camera, Users, Award, MapPin } from 'lucide-react';

export const ReviewsFeed = () => {
  const filterTags = ['Recent', 'Helpful', 'Photos', 'Timeline', 'Verified'];
  
  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search reviews..." className="pl-10" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              {filterTags.map((tag) => (
                <Badge key={tag} variant="outline" className="cursor-pointer hover:bg-accent">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Featured Review from Circle */}
      <Card className="border-brand-orange/20 bg-orange-50/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-brand-orange" />
            <CardTitle className="text-lg text-brand-orange">From your Circle</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Avatar>
              <AvatarImage src="https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop" />
              <AvatarFallback>SJ</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">Sarah Johnson</span>
                <ConnectedRingsRating value={5} size="sm" />
                <span className="text-sm text-muted-foreground">2 days ago</span>
              </div>
              <p className="text-sm mb-3">
                "Been using Cosmix protein powder for 6 months now. Quality is consistent and the chocolate flavor is amazing! 
                Definitely recommend for anyone looking for clean plant-based protein."
              </p>
              <div className="flex gap-2">
                <img 
                  src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=80&h=80&fit=crop" 
                  alt="Review image" 
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <img 
                  src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=80&h=80&fit=crop" 
                  alt="Review image" 
                  className="w-16 h-16 rounded-lg object-cover"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regular Reviews */}
      <div className="grid gap-4">
        {[1, 2, 3].map((index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <Avatar>
                  <AvatarFallback>U{index}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">User {index}</span>
                    <ConnectedRingsRating value={4 + index * 0.2} size="sm" />
                    <span className="text-sm text-muted-foreground">{index + 2} weeks ago</span>
                  </div>
                  <p className="text-sm mb-3">
                    This is a sample review with dummy content. The product quality is good and I would recommend it to others.
                    {index === 2 && " The delivery was fast and packaging was excellent."}
                  </p>
                  {index === 1 && (
                    <div className="flex gap-2">
                      <div className="w-16 h-16 bg-muted rounded-lg"></div>
                      <div className="w-16 h-16 bg-muted rounded-lg"></div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline Review */}
      <Card className="border-l-4 border-l-brand-orange">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Timeline Review
            <Badge variant="secondary">Updated</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { date: "Initial Review", content: "Started using this product, first impressions are positive." },
              { date: "2 weeks later", content: "Seeing good results, will continue using it." },
              { date: "1 month update", content: "Very satisfied with the results, highly recommend!" }
            ].map((update, index) => (
              <div key={index} className="flex gap-4 border-l-2 border-muted pl-4">
                <div className="flex-1">
                  <p className="font-medium text-sm">{update.date}</p>
                  <p className="text-sm text-muted-foreground mt-1">{update.content}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Talk to Circle */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="flex-1">
              <h3 className="font-semibold">Talk to someone in your circle</h3>
              <p className="text-sm text-muted-foreground">Connect with people who have experience with this brand</p>
            </div>
            <Button>Connect</Button>
          </div>
        </CardContent>
      </Card>

      {/* Photo Gallery */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Photos & Videos
            </CardTitle>
            <Button variant="outline" size="sm">Add Photos</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <div key={index} className="aspect-square bg-muted rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* You might also consider */}
      <Card>
        <CardHeader>
          <CardTitle>You might also consider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {['Brand A', 'Brand B', 'Brand C'].map((brand, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="w-12 h-12 bg-muted rounded-lg"></div>
                <div>
                  <p className="font-medium">{brand}</p>
                  <p className="text-sm text-muted-foreground">Similar product</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Meet the Founders */}
      <Card>
        <CardHeader>
          <CardTitle>Meet the Founders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">John Doe</h3>
              <p className="text-sm text-muted-foreground">Co-Founder & CEO</p>
              <p className="text-sm mt-1">10+ years in nutrition and wellness industry</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

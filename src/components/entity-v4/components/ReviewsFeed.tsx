
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Search, 
  Star, 
  MessageCircle, 
  Camera, 
  Users, 
  CheckCircle2,
  Calendar,
  Heart,
  Share2
} from 'lucide-react';

export const ReviewsFeed = () => {
  return (
    <div className="space-y-8">
      {/* Overview Section */}
      <div id="overview" className="space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search reviews..." 
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">All Reviews</Badge>
                <Badge variant="outline">5 Stars</Badge>
                <Badge variant="outline">With Photos</Badge>
                <Badge variant="outline">Recent</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Review Cards */}
        <div className="space-y-4">
          {/* Regular Review */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Avatar>
                  <AvatarFallback>SA</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">Sarah Anderson</h4>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">2 days ago</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Heart className="w-4 h-4" />
                        12
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm">
                    Amazing quality supplements! I've been using their protein powder for 3 months now and 
                    the results are incredible. Great taste, mixes well, and no artificial aftertaste. 
                    Highly recommend for anyone serious about fitness.
                  </p>
                  <div className="flex gap-2">
                    <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                      <span className="text-xs">IMG</span>
                    </div>
                    <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                      <span className="text-xs">IMG</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Circle Review (Highlighted) */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Avatar>
                  <AvatarFallback>MK</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">Mike Kumar</h4>
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          From your Circle
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`w-4 h-4 ${star <= 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">1 week ago</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm">
                    Been a loyal customer for over a year. Their commitment to quality and transparency 
                    sets them apart. The new collagen supplement is a game-changer!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Review */}
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Avatar>
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-4">
                  <div>
                    <h4 className="font-semibold">Jessica Davis</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Timeline Review</Badge>
                      <span className="text-sm text-muted-foreground">Started 3 months ago</span>
                    </div>
                  </div>
                  
                  {/* Timeline */}
                  <div className="space-y-4 ml-4 border-l-2 border-muted pl-4">
                    <div className="relative">
                      <div className="absolute -left-6 w-3 h-3 bg-primary rounded-full"></div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Week 1</span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} className={`w-3 h-3 ${star <= 3 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm">Started with the basic protein powder. Taste is good, mixing well.</p>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute -left-6 w-3 h-3 bg-primary rounded-full"></div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Month 2</span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} className={`w-3 h-3 ${star <= 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm">Noticing improved energy levels. Added their multivitamin to my routine.</p>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute -left-6 w-3 h-3 bg-green-500 rounded-full"></div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Month 3</span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={star} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm">Excellent results! Strength gains are noticeable. Will definitely continue.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Talk to Circle */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Talk to someone in your circle</h3>
            </div>
            <p className="text-sm text-blue-700 mb-4">
              Connect with 12 people in your network who have experience with Cosmix
            </p>
            <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
              <MessageCircle className="w-4 h-4 mr-2" />
              Start Conversation
            </Button>
          </CardContent>
        </Card>

        {/* Photo Gallery */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Photos & Videos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square bg-muted rounded-md flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Photo {i}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full">
              <Camera className="w-4 h-4 mr-2" />
              Add Photos or Videos
            </Button>
          </CardContent>
        </Card>

        {/* You Might Also Consider */}
        <Card>
          <CardHeader>
            <CardTitle>You might also consider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['HealthyBrand', 'NutriMax', 'VitalPro'].map((brand) => (
                <div key={brand} className="border rounded-lg p-4 space-y-3">
                  <div className="w-full h-24 bg-muted rounded-md flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">{brand}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{brand}</h4>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">4.2</span>
                    </div>
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
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <span className="text-sm">Founder</span>
              </div>
              <div>
                <h4 className="font-semibold">Rahul Sharma</h4>
                <p className="text-sm text-muted-foreground">Co-Founder & CEO</p>
                <p className="text-sm mt-1">
                  "Our mission is to make premium wellness accessible to everyone through transparent, 
                  science-backed nutrition."
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Section */}
      <div id="products" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Whey Protein', 'Multivitamin', 'Collagen', 'Pre-Workout'].map((product) => (
                <div key={product} className="border rounded-lg p-4 space-y-3">
                  <div className="w-full h-32 bg-muted rounded-md flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">{product}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{product}</h4>
                    <p className="text-sm text-muted-foreground">Premium quality supplement</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-semibold">₹1,299</span>
                      <Button size="sm">View Details</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Posts Section */}
      <div id="posts" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Latest Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                'New Product Launch: Plant-Based Protein',
                'The Science Behind Our Collagen Formula',
                'Wellness Tips: Morning Routine Essentials'
              ].map((post, index) => (
                <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
                  <h4 className="font-medium mb-2">{post}</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>March {15 - index}, 2024</span>
                    <span>•</span>
                    <span>2 min read</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

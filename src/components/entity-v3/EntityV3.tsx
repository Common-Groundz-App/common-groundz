import React from 'react';
import { useParams } from 'react-router-dom';
import { 
  ChevronRight, Star, Share, Edit3, Heart, Camera, MapPin, Globe, 
  Navigation, UserPlus, TrendingUp, MessageCircle, Users, Clock,
  Phone, Mail, ExternalLink, Image, ThumbsUp, Calendar, Search,
  Filter, MoreHorizontal, Award
} from 'lucide-react';
import NavBarComponent from '@/components/NavBarComponent';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export const EntityV3 = () => {
  const { slug } = useParams<{ slug: string }>();

  // Mock data
  const mockEntity = {
    name: 'Taj Palace Restaurant',
    category: 'Indian Restaurant',
    rating: 4.5,
    reviewCount: 1247,
    ranking: '#1 of 200 Restaurants in Bangalore',
    tags: ['Indian', 'Asian', '₹₹₹₹'],
    claimed: true,
    location: 'Brigade Road, Bangalore',
    description: 'Authentic Indian cuisine in the heart of Bangalore. Experience traditional flavors with a modern twist in our elegant dining atmosphere.',
    circleRating: 4.7,
    circleReviewCount: 89,
    hours: 'Open now • Closes 11 PM',
    website: 'www.tajpalacebangalore.com',
    phone: '+91 98765 43210',
    address: '123 Brigade Road, Bangalore, Karnataka 560001'
  };

  const breadcrumbs = [
    { label: 'Asia', href: '#' },
    { label: 'India', href: '#' },
    { label: 'Karnataka', href: '#' },
    { label: 'Bangalore', href: '#' },
    { label: 'Restaurants', href: '#' }
  ];

  const heroImages = [
    {
      url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop',
      category: 'Interior',
      count: 127
    },
    {
      url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
      category: 'Food',
      count: 89
    },
    {
      url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
      category: 'Exterior',
      count: 45
    }
  ];

  const renderStars = (rating: number, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            className={`${sizeClass} ${
              index < fullStars
                ? 'fill-yellow-400 text-yellow-400'
                : index === fullStars && hasHalfStar
                ? 'fill-yellow-400/50 text-yellow-400'
                : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}
      <NavBarComponent />
      
      {/* Main Content */}
      <div className="pt-16">
        {/* Breadcrumbs */}
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-3">
            <nav className="flex items-center text-sm text-muted-foreground">
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <a href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </a>
                  {index < breadcrumbs.length - 1 && (
                    <ChevronRight className="w-4 h-4 mx-2" />
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>
        </div>

        {/* Entity Title Section */}
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
                    {mockEntity.name}
                  </h1>
                  {mockEntity.claimed && (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                      ✓ Claimed
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    {renderStars(mockEntity.rating)}
                    <span className="font-semibold text-lg">{mockEntity.rating}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {mockEntity.reviewCount.toLocaleString()} reviews
                  </span>
                </div>

                <p className="text-muted-foreground mb-2">{mockEntity.ranking}</p>
                
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {mockEntity.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Description */}
                <p className="text-muted-foreground mb-4 max-w-2xl">
                  {mockEntity.description}
                </p>

                {/* Circle Rating */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Circle Rating:</span>
                    <div className="flex items-center gap-1">
                      {renderStars(mockEntity.circleRating, 'sm')}
                      <span className="font-semibold text-blue-800">{mockEntity.circleRating}</span>
                    </div>
                    <span className="text-xs text-blue-600">({mockEntity.circleReviewCount} reviews)</span>
                  </div>
                </div>

                {/* Additional Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Button className="gap-2">
                    <Navigation className="w-4 h-4" />
                    Get Directions
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Globe className="w-4 h-4" />
                    Visit Website
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    Follow
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Share className="w-4 h-4" />
                  Share
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Edit3 className="w-4 h-4" />
                  Review
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Heart className="w-4 h-4" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Image Section */}
        <div className="bg-white">
          <div className="container mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-96">
              {/* Main Image */}
              <div className="lg:col-span-3 relative group cursor-pointer overflow-hidden rounded-lg">
                <img
                  src={heroImages[0].url}
                  alt="Restaurant interior"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Camera className="w-4 h-4" />
                    {heroImages[0].category} ({heroImages[0].count})
                  </span>
                </div>
              </div>

              {/* Side Images */}
              <div className="space-y-4">
                {heroImages.slice(1).map((image, index) => (
                  <div key={index} className="relative group cursor-pointer overflow-hidden rounded-lg h-44">
                    <img
                      src={image.url}
                      alt={`${image.category} view`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                    <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                      {image.category} ({image.count})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Trust & Review Summary */}
        <div className="bg-gray-50 py-8">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Review Summary Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Review Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map((stars) => (
                      <div key={stars} className="flex items-center gap-3">
                        <span className="text-sm w-2">{stars}</span>
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <Progress value={stars === 5 ? 68 : stars === 4 ? 22 : stars === 3 ? 7 : stars === 2 ? 2 : 1} className="flex-1" />
                        <span className="text-sm text-muted-foreground w-8">
                          {stars === 5 ? '68%' : stars === 4 ? '22%' : stars === 3 ? '7%' : stars === 2 ? '2%' : '1%'}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Trust Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Trust Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Circle Certified</span>
                      <span className="font-semibold text-green-600">78%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Repurchase Rate</span>
                      <span className="font-semibold text-blue-600">63%</span>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Last updated 3 days ago</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ask Community */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ask the Community</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Input placeholder="Ask a question..." />
                    <Button className="w-full" variant="outline">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Post Question
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Rating Evolution Chart */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Rating Evolution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <div className="font-bold text-2xl">4.7</div>
                      <div className="text-sm text-muted-foreground">6 months ago</div>
                    </div>
                    <TrendingUp className="w-6 h-6 text-muted-foreground" />
                    <div className="text-center">
                      <div className="font-bold text-2xl">4.2</div>
                      <div className="text-sm text-muted-foreground">3 months ago</div>
                    </div>
                    <TrendingUp className="w-6 h-6 text-muted-foreground" />
                    <div className="text-center">
                      <div className="font-bold text-2xl">3.9</div>
                      <div className="text-sm text-muted-foreground">1 month ago</div>
                    </div>
                    <TrendingUp className="w-6 h-6 text-green-500" />
                    <div className="text-center">
                      <div className="font-bold text-2xl text-green-600">4.3</div>
                      <div className="text-sm text-muted-foreground">Current</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* SECTION 3: Reviews & Social Proof */}
        <div className="bg-white py-8">
          <div className="container mx-auto px-4">
            {/* Search and Filter */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input placeholder="Search reviews..." className="pl-10" />
                </div>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filter
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Reviews Column */}
              <div className="lg:col-span-2 space-y-6">
                <h2 className="text-2xl font-bold">Reviews</h2>
                
                {/* Review Cards */}
                <div className="space-y-6">
                  {/* Circle Review */}
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face" />
                          <AvatarFallback>JD</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-semibold">John Doe</h4>
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">From your Circle</Badge>
                            </div>
                            <div className="text-right">
                              {renderStars(5, 'sm')}
                              <p className="text-sm text-muted-foreground">2 days ago</p>
                            </div>
                          </div>
                          <p className="text-sm mb-3">Amazing food and excellent service! The butter chicken was absolutely divine and the naan was fresh and warm. Highly recommend this place for authentic Indian cuisine.</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <button className="flex items-center gap-1 hover:text-foreground">
                              <ThumbsUp className="w-4 h-4" />
                              12
                            </button>
                            <button className="hover:text-foreground">Reply</button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Regular Review with Timeline */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarImage src="https://images.unsplash.com/photo-1494790108755-2616b612b29c?w=40&h=40&fit=crop&crop=face" />
                          <AvatarFallback>SM</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">Sarah Miller</h4>
                            <div className="text-right">
                              {renderStars(4, 'sm')}
                              <p className="text-sm text-muted-foreground">1 week ago</p>
                            </div>
                          </div>
                          <p className="text-sm mb-3">Great food, but service was a bit slow during peak hours.</p>
                          
                          {/* Timeline Update */}
                          <div className="bg-gray-50 p-3 rounded border-l-4 border-blue-500 mb-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Clock className="w-4 h-4 text-blue-500" />
                              <span className="text-sm font-medium">Update - 3 days ago</span>
                            </div>
                            <p className="text-sm">Went back again and the service was much better! Updating my review to 4 stars.</p>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <button className="flex items-center gap-1 hover:text-foreground">
                              <ThumbsUp className="w-4 h-4" />
                              8
                            </button>
                            <button className="hover:text-foreground">Reply</button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Another Review */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarFallback>RK</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">Raj Kumar</h4>
                            <div className="text-right">
                              {renderStars(5, 'sm')}
                              <p className="text-sm text-muted-foreground">2 weeks ago</p>
                            </div>
                          </div>
                          <p className="text-sm mb-3">Authentic taste and reasonable prices. The dal makhani is a must-try! Will definitely come back with family.</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <button className="flex items-center gap-1 hover:text-foreground">
                              <ThumbsUp className="w-4 h-4" />
                              15
                            </button>
                            <button className="hover:text-foreground">Reply</button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Add Photos Section */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold mb-2">Add Photos & Videos</h3>
                      <p className="text-sm text-muted-foreground mb-4">Help others by sharing your experience</p>
                      <Button className="gap-2">
                        <Camera className="w-4 h-4" />
                        Upload Photos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Talk to Circle */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Talk to Your Circle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">3 people in your circle have been here</p>
                    <Button className="w-full gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Start Conversation
                    </Button>
                  </CardContent>
                </Card>

                {/* You Might Also Consider */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">You Might Also Consider</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { name: 'Spice Garden', rating: 4.3, image: 'https://images.unsplash.com/photo-1552566321-4f650ed15d6b?w=60&h=60&fit=crop' },
                        { name: 'Royal Kitchen', rating: 4.1, image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=60&h=60&fit=crop' },
                        { name: 'Delhi Darbar', rating: 4.4, image: 'https://images.unsplash.com/photo-1505253213351-f4c0f0a8d7c5?w=60&h=60&fit=crop' }
                      ].map((restaurant, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <img src={restaurant.image} alt={restaurant.name} className="w-12 h-12 rounded object-cover" />
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{restaurant.name}</h4>
                            <div className="flex items-center gap-1">
                              {renderStars(restaurant.rating, 'sm')}
                              <span className="text-xs text-muted-foreground">{restaurant.rating}</span>
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
                    <CardTitle className="text-lg">Meet the Owner</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=48&h=48&fit=crop&crop=face" />
                        <AvatarFallback>AS</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold">Arjun Singh</h4>
                        <p className="text-sm text-muted-foreground">Owner & Head Chef</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">25+ years of culinary experience bringing authentic flavors to Bangalore.</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: Navigation Tabs */}
        <div className="bg-white border-b sticky top-16 z-40">
          <div className="container mx-auto px-4">
            <nav className="flex space-x-8">
              {[
                { name: 'Overview', count: null },
                { name: 'Products', count: 24 },
                { name: 'Posts', count: 12 }
              ].map((tab) => (
                <button
                  key={tab.name}
                  className="py-4 px-1 border-b-2 border-transparent hover:border-primary/50 focus:border-primary text-muted-foreground hover:text-foreground focus:text-foreground transition-colors font-medium flex items-center gap-2"
                >
                  {tab.name}
                  {tab.count && (
                    <Badge variant="secondary" className="text-xs">
                      {tab.count}
                    </Badge>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* SECTION 5: Info & Discovery */}
        <div className="bg-gray-50 py-8">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Related Entities */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Related Places</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { name: 'Cafe Noir', type: 'Coffee Shop', image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=60&h=60&fit=crop' },
                      { name: 'Book Haven', type: 'Bookstore', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=60&h=60&fit=crop' },
                      { name: 'Art Gallery 21', type: 'Gallery', image: 'https://images.unsplash.com/photo-1544967082-d9759a84a2a6?w=60&h=60&fit=crop' }
                    ].map((place, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <img src={place.image} alt={place.name} className="w-12 h-12 rounded object-cover" />
                        <div>
                          <h4 className="font-medium text-sm">{place.name}</h4>
                          <p className="text-xs text-muted-foreground">{place.type}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Hours & Contact */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Hours & Contact</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium text-sm">Hours</span>
                      </div>
                      <p className="text-sm text-green-600 font-medium">Open now • Closes 11 PM</p>
                      <div className="text-xs text-muted-foreground mt-2">
                        <p>Mon-Fri: 9:00 AM - 11:00 PM</p>
                        <p>Sat-Sun: 10:00 AM - 12:00 AM</p>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Phone className="w-4 h-4" />
                        <span className="font-medium text-sm">Phone</span>
                      </div>
                      <p className="text-sm">{mockEntity.phone}</p>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <ExternalLink className="w-4 h-4" />
                        <span className="font-medium text-sm">Website</span>
                      </div>
                      <p className="text-sm text-blue-600">{mockEntity.website}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* About & Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Established in 1995, Taj Palace has been serving authentic Indian cuisine to locals and tourists alike. Our family recipes have been passed down through generations.
                    </p>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4" />
                        <span className="font-medium text-sm">Address</span>
                      </div>
                      <p className="text-sm">{mockEntity.address}</p>
                    </div>
                    
                    <div className="pt-4 space-y-2">
                      <Button variant="outline" className="w-full text-sm">
                        Suggest an Edit
                      </Button>
                      <Button variant="outline" className="w-full text-sm gap-2">
                        <Award className="w-4 h-4" />
                        Claim This Business
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityV3;
import React from 'react';
import { useParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';
import { useEntityDetailCached } from '@/hooks/use-entity-detail-cached';
import { EntityParentBreadcrumb } from '@/components/entity/EntityParentBreadcrumb';
import { useEntityHierarchy } from '@/hooks/use-entity-hierarchy';
import { getEntityTypeFallbackImage } from '@/services/entityTypeMapping';
import { useCircleRating } from '@/hooks/use-circle-rating';
import { CircleContributorsPreview } from '@/components/recommendations/CircleContributorsPreview';
import { getSentimentColor, getSentimentLabel } from '@/utils/ratingColorUtils';
import { useAuth } from '@/contexts/AuthContext';
import { Star, MapPin, Globe, Phone, Mail, Share2, Heart, Bookmark, MessageCircle, Camera, Clock, CheckCircle, TrendingUp, Users, Award, Eye, AlertTriangle } from "lucide-react";
import { ConnectedRingsRating } from "@/components/ui/connected-rings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ReviewCard from "@/components/ReviewCard";

const EntityV4 = () => {
  const { slug } = useParams<{ slug: string }>();
  
  // Fetch real entity data
  const {
    entity,
    reviews,
    stats,
    isLoading,
    error
  } = useEntityDetailCached(slug || '');
  
  // Fetch entity hierarchy data
  const {
    parentEntity,
    isLoading: hierarchyLoading
  } = useEntityHierarchy(entity?.id || null);

  // Fetch circle rating data
  const { user } = useAuth();
  const {
    circleRating,
    circleRatingCount,
    circleContributors,
    isLoading: isCircleRatingLoading
  } = useCircleRating(entity?.id || '');

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <NavBarComponent />
        <EntityPreviewToggle />
        <div className="flex-1 pt-16 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading entity...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (!isLoading && (error || !entity)) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <NavBarComponent />
        <EntityPreviewToggle />
        <div className="flex-1 pt-16 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-destructive mb-2">Entity Not Found</h2>
            <p className="text-muted-foreground">The entity you're looking for doesn't exist or has been removed.</p>
          </div>
        </div>
      </div>
    );
  }

  // Get entity image with fallback
  const entityImage = entity?.image_url || getEntityTypeFallbackImage(entity?.type || 'product');
  
  // Prepare entity data using real data
  const entityData = {
    name: entity?.name || '',
    description: entity?.description || '',
    rating: stats?.averageRating || 0,
    totalReviews: stats?.reviewCount || 0,
    
    claimed: entity?.is_claimed || false,
    image: entityImage,
    website: entity?.website_url || '',
    location: entity?.venue || '',
    email: '', // TODO: Extract from metadata when available
    phone: ''  // TODO: Extract from metadata when available
  };

  // Trust Metrics
  const trustMetrics = {
    circleCertified: 78,
    repurchaseRate: 63,
    ratingBreakdown: {
      5: 45,
      4: 30,
      3: 15,
      2: 7,
      1: 3
    }
  };

  // Mock Reviews
  const mockReviews = [{
    id: 1,
    name: "Priya Sharma",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b515?w=50&h=50&fit=crop",
    rating: 5,
    date: "2024-01-15",
    title: "Excellent protein powder quality!",
    content: "I've been using Cosmix whey protein for 6 months now and the results are amazing. The taste is great and it mixes well without clumps.",
    verified: true,
    helpful: 23
  }, {
    id: 2,
    name: "Rahul Kumar",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop",
    rating: 4,
    date: "2024-01-10",
    title: "Good value for money",
    content: "The supplements are effective and reasonably priced compared to other premium brands. Delivery was quick too.",
    verified: true,
    helpful: 15
  }, {
    id: 3,
    name: "Sneha Patel",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=50&h=50&fit=crop",
    rating: 5,
    date: "2024-01-08",
    title: "Circle recommended - Worth it!",
    content: "Found this through Circle recommendations and so glad I tried it. The multivitamins have really improved my energy levels.",
    verified: true,
    helpful: 31
  }];

  // Related Entities
  const relatedEntities = [{
    name: "HealthifyMe",
    rating: 4.2,
    category: "Health Apps",
    image: "https://images.unsplash.com/photo-1500673922987-e212871fec22?w=100&h=100&fit=crop"
  }, {
    name: "MyFitnessPal",
    rating: 4.0,
    category: "Fitness Apps",
    image: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=100&h=100&fit=crop"
  }, {
    name: "Optimum Nutrition",
    rating: 4.5,
    category: "Supplements",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=100&h=100&fit=crop"
  }];

  return <TooltipProvider delayDuration={0}>
    <div className="min-h-screen flex flex-col bg-background">
      <NavBarComponent />
      
      {/* Version Toggle */}
      <EntityPreviewToggle />
      
      {/* Main Content */}
      <div className="flex-1 pt-16">
        <div className="min-h-screen bg-gray-50">
          {/* SECTION 1: Header & Primary Actions */}
          <div className="bg-white border-b">
            <div className="max-w-7xl mx-auto px-4 py-6">
               {/* Breadcrumb */}
               <EntityParentBreadcrumb 
                 currentEntity={entity}
                 parentEntity={parentEntity}
                 isLoading={hierarchyLoading}
               />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Brand Info */}
                <div className="lg:col-span-2">
                  <div className="flex gap-6">
                    <img src={entityData.image} alt={entityData.name} className="w-24 h-24 rounded-lg object-cover" />
                    <div className="flex-1">
                         <div className="flex items-center gap-3 mb-2">
                         <h1 className="text-3xl font-bold text-gray-900">{entityData.name}</h1>
                          <Tooltip>
                           <TooltipTrigger asChild>
                             {entityData.claimed ? (
                               <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer">
                                 <CheckCircle className="w-3 h-3 mr-1" />
                                 Claimed
                               </div>
                             ) : (
                               <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer">
                                 <AlertTriangle className="w-3 h-3 mr-1" />
                                 Unclaimed
                               </div>
                             )}
                           </TooltipTrigger>
                           <TooltipContent side="bottom" className="bg-popover text-popover-foreground border rounded-md shadow-md p-3 max-w-xs">
                             <p className="text-sm">
                               {entityData.claimed 
                                 ? "This listing is actively managed by the owner." 
                                 : "This listing hasn't been claimed yet. Claim it for free to update info, add photos, respond to reviews, and more."
                               }
                             </p>
                           </TooltipContent>
                         </Tooltip>
                       </div>
                      <p className="text-gray-600 mb-4 leading-relaxed">{entityData.description}</p>
                      
                        {/* Ratings */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex items-center gap-4 flex-shrink-0 min-w-[300px]">
                            <div className="flex items-center gap-2">
                              <ConnectedRingsRating
                                value={entityData.rating}
                                variant="badge"
                                showValue={false}
                                size="md"
                                minimal={true}
                              />
                              <span 
                                className="text-lg font-bold" 
                                style={{ color: getSentimentColor(entityData.rating) }}
                              >
                                {entityData.rating.toFixed(1)}
                              </span>
                            </div>
                            
                            <div className="leading-tight min-w-[140px]">
                              <div className="font-semibold text-sm whitespace-nowrap text-gray-900">Overall Rating</div>
                              <div className="text-xs text-muted-foreground">
                                ({entityData.totalReviews.toLocaleString()} {entityData.totalReviews === 1 ? 'review' : 'reviews'})
                              </div>
                              <div className="text-sm font-bold text-gray-900">
                                {getSentimentLabel(entityData.rating)}
                              </div>
                            </div>
                          </div>
                          {user && (
                            circleRating !== null ? (
                              <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-fit">
                                    <ConnectedRingsRating
                                      value={circleRating}
                                      variant="badge"
                                      showValue={false}
                                      size="md"
                                      minimal={true}
                                    />
                                  </div>
                                  <span 
                                    className="text-lg font-bold" 
                                    style={{ color: getSentimentColor(circleRating) }}
                                  >
                                    {circleRating.toFixed(1)}
                                  </span>
                                </div>

                                <div className="leading-tight min-w-[140px]">
                                  <div className="font-semibold text-sm whitespace-nowrap text-brand-orange">Circle Rating</div>
                                  <div className="text-xs text-muted-foreground">
                                    Based on {circleRatingCount} rating{circleRatingCount !== 1 ? 's' : ''} from your circle
                                  </div>
                                  <CircleContributorsPreview 
                                    contributors={circleContributors}
                                    totalCount={circleRatingCount}
                                    maxDisplay={4}
                                    entityName={entity?.name}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                  <div className="w-fit">
                                    <ConnectedRingsRating
                                      value={0}
                                      variant="badge"
                                      showValue={false}
                                      size="md"
                                      minimal={true}
                                    />
                                  </div>
                                  <span className="text-lg font-bold text-muted-foreground">
                                    0
                                  </span>
                                </div>

                                <div className="leading-tight min-w-[140px]">
                                  <div className="font-semibold text-sm whitespace-nowrap text-brand-orange">Circle Rating</div>
                                  <div className="text-xs text-muted-foreground">
                                    No ratings from your circle
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-3">
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          Write Review
                        </Button>
                        <Button 
                          variant="outline" 
                          className="border-blue-600 text-blue-600 hover:bg-blue-50"
                          onClick={() => entityData.website && window.open(`https://${entityData.website.replace(/^https?:\/\//, '')}`, '_blank')}
                          disabled={!entityData.website}
                        >
                          <Globe className="w-4 h-4 mr-2" />
                          Visit Website
                        </Button>
                        <Button variant="outline">
                          <MapPin className="w-4 h-4 mr-2" />
                          Get Directions
                        </Button>
                        <Button variant="outline" size="icon">
                          <Share2 className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon">
                          <Heart className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon">
                          <Bookmark className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Map */}
                
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-3">
                {/* SECTION 2: Trust & Review Summary */}
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-blue-600" />
                      Trust Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Circle Certified</span>
                          <span className="text-sm font-semibold text-green-600">{trustMetrics.circleCertified}%</span>
                        </div>
                        <Progress value={trustMetrics.circleCertified} className="mb-4" />
                        
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Repurchase Rate</span>
                          <span className="text-sm font-semibold text-blue-600">{trustMetrics.repurchaseRate}%</span>
                        </div>
                        <Progress value={trustMetrics.repurchaseRate} className="mb-4" />
                      </div>

                      <div>
                        <h4 className="font-medium mb-3">Rating Breakdown</h4>
                        {Object.entries(trustMetrics.ratingBreakdown).reverse().map(([stars, percentage]) => <div key={stars} className="flex items-center gap-3 mb-2">
                            <span className="text-sm w-8">{stars}★</span>
                            <Progress value={percentage} className="flex-1" />
                            <span className="text-sm w-8 text-right">{percentage}%</span>
                          </div>)}
                      </div>
                    </div>

                    <Separator className="my-4" />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm">Rating Evolution: 4.7 → 4.2 → 3.9 → 4.3</span>
                      </div>
                      <span className="text-xs text-gray-500">Last Updated: 2 days ago</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Ask Community */}
                <Card className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <MessageCircle className="w-8 h-8 text-blue-600" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">Ask the Community</h3>
                        <p className="text-sm text-gray-600">Get answers from people who have used Cosmix products</p>
                      </div>
                      <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                        Ask Question
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* SECTION 3: Reviews & Social Proof */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Reviews & Social Proof</h2>
                    <div className="flex gap-2">
                      <Badge variant="outline">Most Recent</Badge>
                      <Badge variant="outline">Verified Only</Badge>
                      <Badge variant="outline">5 Stars</Badge>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative mb-6">
                    <input type="text" placeholder="Search reviews..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                  </div>

                  {/* Review Cards */}
                  <div className="space-y-6">
                    {mockReviews.map(review => <ReviewCard key={review.id} review={review} />)}

                    {/* Timeline Review */}
                    <Card className="border-l-4 border-l-blue-500">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop" alt="Timeline reviewer" className="w-12 h-12 rounded-full" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">Arjun Mehta</h4>
                              <Badge className="bg-blue-100 text-blue-800">Timeline Review</Badge>
                            </div>
                            <div className="space-y-4">
                              <div className="border-l-2 border-gray-200 pl-4">
                                <div className="text-sm text-gray-500 mb-1">3 months ago</div>
                                <p className="text-gray-700">Started using Cosmix whey protein. Initial impressions are good.</p>
                              </div>
                              <div className="border-l-2 border-gray-200 pl-4">
                                <div className="text-sm text-gray-500 mb-1">2 months ago</div>
                                <p className="text-gray-700">Seeing good results in muscle gain. Taste is better than expected.</p>
                              </div>
                              <div className="border-l-2 border-blue-400 pl-4">
                                <div className="text-sm text-gray-500 mb-1">1 week ago</div>
                                <p className="text-gray-700">Completely satisfied! Will definitely repurchase. ⭐⭐⭐⭐⭐</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Circle Highlighted Review */}
                    <Card className="border-2 border-blue-200 bg-blue-50/30">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Badge className="bg-blue-600 text-white">Circle Highlighted</Badge>
                          <Eye className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-blue-600 font-medium">Trending in your network</span>
                        </div>
                        <ReviewCard review={mockReviews[2]} />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Photo Gallery */}
                  <Card className="mt-8">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Camera className="w-5 h-5" />
                          Photos & Videos
                        </CardTitle>
                        <Button variant="outline" size="sm">
                          <Camera className="w-4 h-4 mr-2" />
                          Add Photos
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
                            <Camera className="w-6 h-6 text-gray-400" />
                          </div>)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* You Might Also Consider */}
                  <Card className="mt-8">
                    <CardHeader>
                      <CardTitle>You Might Also Consider</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {relatedEntities.map((entity, index) => <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                            <img src={entity.image} alt={entity.name} className="w-12 h-12 rounded-lg object-cover" />
                            <div className="flex-1">
                              <h4 className="font-medium">{entity.name}</h4>
                              <p className="text-sm text-gray-500">{entity.category}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-sm">{entity.rating}</span>
                              </div>
                            </div>
                          </div>)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Meet the Founders */}
                  <Card className="mt-8">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop" alt="Founder" className="w-16 h-16 rounded-full object-cover" />
                        <div>
                          <h3 className="font-semibold text-gray-900">Meet the Founder</h3>
                          <p className="text-blue-600 font-medium">Rohit Sharma</p>
                          <p className="text-sm text-gray-600">CEO & Co-founder</p>
                          <p className="text-sm text-gray-500 mt-1">15+ years in health & wellness industry</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* SECTION 4: Tabs Navigation */}
                <Tabs defaultValue="overview" className="mb-8">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="products">Products</TabsTrigger>
                    <TabsTrigger value="posts">Posts</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="mt-6">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="font-semibold mb-4">Company Overview</h3>
                        <p className="text-gray-600 leading-relaxed">
                          Cosmix is a leading health and wellness brand that has been at the forefront of providing 
                          science-backed nutrition solutions for over a decade. Founded with the mission to make 
                          premium supplements accessible to everyone, we focus on quality, transparency, and innovation.
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="products" className="mt-6">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="font-semibold mb-4">Featured Products</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border rounded-lg p-4">
                            <h4 className="font-medium">Whey Protein Isolate</h4>
                            <p className="text-sm text-gray-600">Premium quality protein powder</p>
                            <div className="flex items-center gap-1 mt-2">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm">4.5 (234 reviews)</span>
                            </div>
                          </div>
                          <div className="border rounded-lg p-4">
                            <h4 className="font-medium">Complete Multivitamin</h4>
                            <p className="text-sm text-gray-600">Essential vitamins and minerals</p>
                            <div className="flex items-center gap-1 mt-2">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm">4.3 (189 reviews)</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="posts" className="mt-6">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="font-semibold mb-4">Latest Posts</h3>
                        <div className="space-y-4">
                          <div className="border-b pb-4">
                            <h4 className="font-medium mb-2">New Product Launch: Plant-Based Protein</h4>
                            <p className="text-sm text-gray-600">We're excited to announce our latest addition to the Cosmix family...</p>
                            <span className="text-xs text-gray-400">2 days ago</span>
                          </div>
                          <div className="border-b pb-4">
                            <h4 className="font-medium mb-2">The Science Behind Whey Protein</h4>
                            <p className="text-sm text-gray-600">Understanding the benefits and optimal usage of whey protein...</p>
                            <span className="text-xs text-gray-400">1 week ago</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>

              {/* SECTION 5: Info & Discovery Sidebar */}
              <div className="lg:col-span-1">
                <div className="space-y-6 sticky top-8">
                  {/* Business Hours */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="w-5 h-5" />
                        Business Hours
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Monday - Friday</span>
                          <span className="text-green-600 font-medium">10 AM - 7 PM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Saturday</span>
                          <span className="text-green-600 font-medium">10 AM - 6 PM</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sunday</span>
                          <span className="text-red-600 font-medium">Closed</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{entityData.location}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{entityData.email}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{entityData.phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{entityData.website}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* About Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">About</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 leading-relaxed mb-4">
                        Cosmix is committed to delivering the highest quality health and wellness products. 
                        Our team of experts ensures that every product meets rigorous quality standards 
                        and is backed by scientific research.
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        Suggest an Edit
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Related Entities */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Related Brands</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {relatedEntities.map((entity, index) => <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <img src={entity.image} alt={entity.name} className="w-8 h-8 rounded object-cover" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{entity.name}</h4>
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs">{entity.rating}</span>
                              </div>
                            </div>
                          </div>)}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Talk to Circle */}
                  <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
                    <CardContent className="p-4 text-center">
                      <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-gray-900 mb-2">Talk to Someone in Your Circle</h3>
                      <p className="text-sm text-gray-600 mb-3">Connect with people who have experience with Cosmix</p>
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                        Find Connections
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>;
};
export default EntityV4;

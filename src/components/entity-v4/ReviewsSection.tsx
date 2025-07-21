
import React from 'react';
import { MessageCircle, Camera, Eye, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReviewCard from "@/components/ReviewCard";

export const ReviewsSection: React.FC = () => {
  // Mock Reviews - TODO: Replace with real data
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

  return (
    <>
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
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
                  <Camera className="w-6 h-6 text-gray-400" />
                </div>
              ))}
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
              {[
                {
                  name: "HealthifyMe",
                  rating: 4.2,
                  category: "Health Apps",
                  image: "https://images.unsplash.com/photo-1500673922987-e212871fec22?w=100&h=100&fit=crop"
                },
                {
                  name: "MyFitnessPal",
                  rating: 4.0,
                  category: "Fitness Apps",
                  image: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=100&h=100&fit=crop"
                },
                {
                  name: "Optimum Nutrition",
                  rating: 4.5,
                  category: "Supplements",
                  image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=100&h=100&fit=crop"
                }
              ].map((entity, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                  <img src={entity.image} alt={entity.name} className="w-12 h-12 rounded-lg object-cover" />
                  <div className="flex-1">
                    <h4 className="font-medium">{entity.name}</h4>
                    <p className="text-sm text-gray-500">{entity.category}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{entity.rating}</span>
                    </div>
                  </div>
                </div>
              ))}
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
    </>
  );
};

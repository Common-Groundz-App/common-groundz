
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthContextBoundary } from "./components/AuthContextBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import EntityDetail from "./pages/EntityDetail";
import Feed from "./pages/Feed";
import Search from "./pages/Search";
import ProductSearch from "./pages/ProductSearch";
import Explore from "./pages/Explore";
import RecommendationView from "./pages/RecommendationView";
import PostView from "./pages/PostView";
import NotFound from "./pages/NotFound";
import AdminPortal from "./pages/AdminPortal";
import ProtectedRoute from "./components/ProtectedRoute";
import { ProfileRedirect } from "./components/ProfileRedirect";
import { AuthInitializer } from "./components/AuthInitializer";
import { PreferencesContextProvider } from "./contexts/PreferencesContext";
import { ContentViewerContextProvider } from "./contexts/ContentViewerContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthContextBoundary>
          <AuthInitializer>
            <PreferencesContextProvider>
              <ContentViewerContextProvider>
                <div className="min-h-screen bg-background font-sans antialiased">
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route 
                      path="/feed" 
                      element={
                        <ProtectedRoute>
                          <Feed />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/profile" 
                      element={
                        <ProtectedRoute>
                          <ProfileRedirect />
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="/profile/:username" element={<Profile />} />
                    <Route 
                      path="/settings" 
                      element={
                        <ProtectedRoute>
                          <Settings />
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="/entity/:id" element={<EntityDetail />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/search/products" element={<ProductSearch />} />
                    <Route path="/explore" element={<Explore />} />
                    <Route path="/recommendations/:id" element={<RecommendationView />} />
                    <Route path="/post/:id" element={<PostView />} />
                    <Route 
                      path="/admin" 
                      element={
                        <ProtectedRoute>
                          <AdminPortal />
                        </ProtectedRoute>
                      } 
                    />
                    <Route path="/404" element={<NotFound />} />
                    <Route path="*" element={<Navigate to="/404" replace />} />
                  </Routes>
                </div>
              </ContentViewerContextProvider>
            </PreferencesContextProvider>
          </AuthInitializer>
        </AuthContextBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

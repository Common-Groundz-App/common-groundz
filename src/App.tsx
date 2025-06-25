
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AuthContextBoundary from "./components/AuthContextBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import RenderProtection from "./components/RenderProtection";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import EntityDetail from "./pages/EntityDetail";
import RecommendationView from "./pages/RecommendationView";
import PostView from "./pages/PostView";
import Search from "./pages/Search";
import ProductSearch from "./pages/ProductSearch";
import Explore from "./pages/Explore";
import Settings from "./pages/Settings";
import AdminPortal from "./pages/AdminPortal";
import AdminEntityEdit from "./pages/AdminEntityEdit";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RenderProtection>
            <AuthContextBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/home" element={
                  <ProtectedRoute>
                    <Feed />
                  </ProtectedRoute>
                } />
                <Route path="/profile/:username" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/entity/:slugOrId" element={
                  <ProtectedRoute>
                    <EntityDetail />
                  </ProtectedRoute>
                } />
                <Route path="/recommendations/:id" element={
                  <ProtectedRoute>
                    <RecommendationView />
                  </ProtectedRoute>
                } />
                <Route path="/post/:id" element={
                  <ProtectedRoute>
                    <PostView />
                  </ProtectedRoute>
                } />
                <Route path="/search" element={
                  <ProtectedRoute>
                    <Search />
                  </ProtectedRoute>
                } />
                <Route path="/products" element={
                  <ProtectedRoute>
                    <ProductSearch />
                  </ProtectedRoute>
                } />
                <Route path="/explore" element={
                  <ProtectedRoute>
                    <Explore />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <AdminRoute>
                    <AdminPortal />
                  </AdminRoute>
                } />
                <Route path="/admin/entities/:id/edit" element={
                  <AdminRoute>
                    <AdminEntityEdit />
                  </AdminRoute>
                } />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthContextBoundary>
          </RenderProtection>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

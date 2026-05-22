import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CartSidebar from "@/components/cart/CartSidebar";
import ScrollToTop from "@/components/ScrollToTop";
import { RouteScrollRestoration } from "@/components/ScrollToTop";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AdminRoute from "@/components/auth/AdminRoute";
import React, { Suspense, useEffect, useState } from "react";
import { applyThemePreference, readThemePreference, watchSystemThemeChanges, watchThemeStorageChanges } from "@/lib/theme";
import { ensureProductsLoaded } from "@/data/products";

// Route-level code splitting — each page loads only when visited
const Index = React.lazy(() => import("./pages/Index"));
const Login = React.lazy(() => import("./pages/Login"));
const Signup = React.lazy(() => import("./pages/Signup"));
const AdminLogin = React.lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard.tsx"));
const ProductDetails = React.lazy(() => import("./pages/ProductDetails"));
const CategoryRedirect = React.lazy(() => import("./pages/CategoryRedirect"));
const Categories = React.lazy(() => import("./pages/Categories"));
const Women = React.lazy(() => import("./pages/Women"));
const Men = React.lazy(() => import("./pages/Men"));
const Boys = React.lazy(() => import("./pages/Boys"));
const Girls = React.lazy(() => import("./pages/Girls"));
const Footwear = React.lazy(() => import("./pages/Footwear"));
const Skincare = React.lazy(() => import("./pages/Skincare"));
const StyleBuilder = React.lazy(() => import("./pages/StyleBuilder"));
const Wishlist = React.lazy(() => import("./pages/Wishlist"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Settings = React.lazy(() => import("./pages/Settings"));
const Checkout = React.lazy(() => import("./pages/Checkout.tsx"));
const CheckoutSuccess = React.lazy(() => import("./pages/CheckoutSuccess.tsx"));
const CheckoutCancel = React.lazy(() => import("./pages/CheckoutCancel.tsx"));
const OrderHistory = React.lazy(() => import("./pages/OrderHistory.tsx"));
const TrackOrder = React.lazy(() => import("./pages/TrackOrder.tsx"));
const InfoPage = React.lazy(() => import("./pages/InfoPage.tsx"));
const ChatRoom = React.lazy(() => import("./pages/ChatRoom.tsx"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center space-y-4 max-w-md">
            <h2 className="font-display text-2xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground text-sm">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    const syncTheme = () => {
      applyThemePreference(readThemePreference());
    };

    syncTheme();
    // Kick off async product catalog load early
    void ensureProductsLoaded();

    const stopWatchingSystemTheme = watchSystemThemeChanges(syncTheme);
    const stopWatchingStorage = watchThemeStorageChanges(syncTheme);

    return () => {
      stopWatchingSystemTheme();
      stopWatchingStorage();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RouteScrollRestoration />
            <Navbar />
            <CartSidebar />
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/women" element={<Women />} />
              <Route path="/men" element={<Men />} />
              <Route path="/boys" element={<Boys />} />
              <Route path="/girls" element={<Girls />} />
              <Route path="/footwear" element={<Footwear />} />
              <Route path="/skincare" element={<Skincare />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/category/:id" element={<CategoryRedirect />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/shop" element={<StyleBuilder />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
              <Route path="/checkout/cancel" element={<ProtectedRoute><CheckoutCancel /></ProtectedRoute>} />
              <Route path="/order-history" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
              <Route path="/track-order" element={<ProtectedRoute><TrackOrder /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatRoom /></ProtectedRoute>} />
              <Route path="/contact" element={<InfoPage />} />
              <Route path="/faqs" element={<InfoPage />} />
              <Route path="/shipping" element={<InfoPage />} />
              <Route path="/returns" element={<InfoPage />} />
              <Route path="/size-guide" element={<InfoPage />} />
              <Route path="/about" element={<InfoPage />} />
              <Route path="/careers" element={<InfoPage />} />
              <Route path="/sustainability" element={<InfoPage />} />
              <Route path="/press" element={<InfoPage />} />
              <Route path="/privacy" element={<InfoPage />} />
              <Route path="/terms" element={<InfoPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </ErrorBoundary>
            <Footer />
            <ScrollToTop />
          </BrowserRouter>
        </CartProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

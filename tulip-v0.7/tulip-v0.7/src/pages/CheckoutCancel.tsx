import React from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CheckoutCancel: React.FC = () => {
  return (
    <main className="min-h-screen bg-background pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-6">
        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-secondary text-foreground flex items-center justify-center mb-3">
              <CircleAlert className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">Payment Not Completed</CardTitle>
            <CardDescription>
              Your Stripe payment was canceled or expired. No order has been created yet.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="pink" size="lg" asChild>
                <Link to="/checkout">Try Payment Again</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/categories">Continue Shopping</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default CheckoutCancel;

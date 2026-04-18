import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StripeCheckoutProps {
  amount: number;
  onSuccess: (paymentId?: string) => void;
  onCancel: () => void;
}

export default function StripeCheckout({ amount, onSuccess, onCancel }: StripeCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + window.location.pathname + '?payment_success=true',
      },
      redirect: 'if_required'
    });

    if (error) {
      toast.error(error.message || 'Payment failed');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    } else {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white/5 p-4 rounded-xl border border-white/10">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      
      <div className="flex gap-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 border-white/10 hover:bg-white/5"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isProcessing || !stripe || !elements} 
          className="flex-1 bg-brand-gold text-brand-dark hover:bg-brand-gold/90 font-bold"
        >
          {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
        </Button>
      </div>
    </form>
  );
}

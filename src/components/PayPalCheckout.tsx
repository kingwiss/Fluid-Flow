import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { toast } from 'sonner';

interface PayPalCheckoutProps {
  amount: number;
  onSuccess: (orderId: string) => void;
  onCancel: () => void;
}

export default function PayPalCheckout({ amount, onSuccess, onCancel }: PayPalCheckoutProps) {
  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
  
  if (!clientId) {
    return (
      <div className="p-4 text-center text-white/50 bg-white/5 rounded-xl border border-white/10">
        PayPal is not configured. Please add VITE_PAYPAL_CLIENT_ID to your secrets.
      </div>
    );
  }

  return (
    <div className="w-full">
      <PayPalScriptProvider options={{ "clientId": clientId, currency: "USD", intent: "capture" }}>
        <PayPalButtons
          style={{ layout: "vertical", shape: "rect", color: "gold" }}
          createOrder={async () => {
            try {
              const response = await fetch((import.meta.env.VITE_API_URL || '') + '/api/paypal/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
              });
              const order = await response.json();
              if (order.id) {
                return order.id;
              } else {
                throw new Error(order.error || 'Failed to create order');
              }
            } catch (err) {
              toast.error('Could not initialize PayPal checkout');
              throw err;
            }
          }}
          onApprove={async (data, actions) => {
            try {
              toast.loading('Capturing payment...');
              const response = await fetch((import.meta.env.VITE_API_URL || '') + '/api/paypal/capture-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderID: data.orderID })
              });
              const captureData = await response.json();
              toast.dismiss();
              
              if (captureData.status === 'COMPLETED') {
                // Extract the capture ID from the PayPal response
                const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
                if (captureId) {
                  onSuccess(captureId);
                } else {
                  // Fallback to order ID if capture ID is somehow missing, though refunds might fail
                  onSuccess(captureData.id);
                }
              } else {
                toast.error('Payment was not completed successfully.');
              }
            } catch (err) {
              toast.dismiss();
              toast.error('Failed to capture payment');
            }
          }}
          onCancel={() => {
            toast.info('PayPal checkout cancelled');
            onCancel();
          }}
          onError={(err) => {
            console.error('PayPal Error:', err);
            toast.error('An error occurred with PayPal');
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
}

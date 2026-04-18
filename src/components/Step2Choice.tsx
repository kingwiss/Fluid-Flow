import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OrderState, OrderStatus } from '../types';
import { ShoppingBag, PhoneCall, CheckCircle2 } from 'lucide-react';

interface Props {
  order: OrderState;
  updateOrder: (updates: Partial<OrderState>) => void;
  onNext: () => void;
}

export default function Step2Choice({ order, updateOrder, onNext }: Props) {
  const handleChoice = (status: OrderStatus) => {
    updateOrder({ status });
    onNext();
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-serif">Order Status</h2>
        <p className="text-white/50">Have you already placed your order with the restaurant?</p>
      </div>

      <div className="grid gap-4">
        <button
          onClick={() => handleChoice('already_ordered')}
          className="group relative overflow-hidden text-left p-6 glass-card hover:bg-white/10 transition-all border-white/10 hover:border-brand-gold/50"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-brand-gold/10 text-brand-gold group-hover:bg-brand-gold group-hover:text-brand-dark transition-colors">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-medium">I already ordered</h3>
              <p className="text-sm text-white/50">I have a receipt or screenshot of my order confirmation.</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => handleChoice('order_for_me')}
          className="group relative overflow-hidden text-left p-6 glass-card hover:bg-white/10 transition-all border-white/10 hover:border-brand-gold/50"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-brand-gold/10 text-brand-gold group-hover:bg-brand-gold group-hover:text-brand-dark transition-colors">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-medium">Order for me</h3>
              <p className="text-sm text-white/50">I need you to place the order for me at the restaurant.</p>
              <p className="text-xs text-brand-gold/80 mt-2">Also, we don't need the payment for the order until the driver is at the restaurant. The driver will show a receipt for proof of how much the food costs when they arrive.</p>
            </div>
          </div>
        </button>
      </div>

      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
        <PhoneCall className="w-5 h-5 text-brand-gold" />
        <p className="text-xs text-white/60">
          If you need us to order, you can choose to stay on the phone with us during the process.
        </p>
      </div>
    </div>
  );
}

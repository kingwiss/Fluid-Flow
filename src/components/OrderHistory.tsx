import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OrderState } from '../types';
import { Package, Clock, MapPin, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  orders: OrderState[];
  onSelectOrder: (order: OrderState) => void;
  onBack: () => void;
}

export default function OrderHistory({ orders, onSelectOrder, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-white/70 hover:text-white">
          <ChevronRight className="w-6 h-6 rotate-180" />
        </Button>
        <h2 className="text-3xl font-serif">Order History</h2>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12 text-white/50">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>No previous orders found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order, idx) => (
            <Card 
              key={order.id || idx}
              onClick={() => onSelectOrder(order)}
              className="p-4 bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-lg">{order.orderDetails || 'Standard Delivery'}</p>
                  <p className="text-xs text-white/50">
                    {order.createdAt && !isNaN(new Date(order.createdAt).getTime()) 
                      ? format(new Date(order.createdAt), 'MMM d, yyyy • h:mm a') 
                      : 'Recent Order'}
                  </p>
                </div>
                <div className="bg-brand-gold/20 text-brand-gold px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">
                  {order.id ? order.id.slice(0, 8) : 'ACTIVE'}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-white/40" />
                  <span className="truncate">{order.pickupAddress}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-gold" />
                  <span className="truncate">{order.deliveryAddress}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

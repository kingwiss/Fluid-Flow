import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { OrderState } from '../types';
import { format } from 'date-fns';
import { Clock, Calendar as CalendarIcon } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';

interface Props {
  order: OrderState;
  updateOrder: (updates: Partial<OrderState>) => void;
  onNext: () => void;
  onTrackOrder?: () => void;
}

const TIME_SLOTS = [
  '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM',
  '10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM', '12:00 AM', '12:30 AM',
  '1:00 AM', '1:30 AM', '2:00 AM', '2:30 AM', '3:00 AM'
];

export default function Step1Schedule({ order, updateOrder, onNext, onTrackOrder }: Props) {
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);

  useEffect(() => {
    if (!order.date || isNaN(new Date(order.date).getTime())) return;
    
    const dateString = format(new Date(order.date), 'yyyy-MM-dd');
    const q = query(collection(db, 'orders'), where('dateString', '==', dateString));
    
    // Fetch orders count
    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.timeSlot) {
          counts[data.timeSlot] = (counts[data.timeSlot] || 0) + 1;
        }
      });
      setSlotCounts(counts);
    });

    // Fetch blocked slots explicitly set by driver
    const blockDocRef = doc(db, 'schedule_blocks', dateString);
    const unsubscribeBlocks = onSnapshot(blockDocRef, (snapshot) => {
      if (snapshot.exists() && snapshot.data()?.blockedSlots) {
        setBlockedSlots(snapshot.data().blockedSlots);
      } else {
        setBlockedSlots([]);
      }
    });

    return () => {
      unsubscribeOrders();
      unsubscribeBlocks();
    };
  }, [order.date]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-serif">When should we deliver?</h2>
          <p className="text-white/50">Select your preferred date and time slot.</p>
        </div>
        {onTrackOrder && (
          <Button variant="outline" onClick={onTrackOrder} className="border-brand-gold/50 text-brand-gold hover:bg-brand-gold/10">
            Track Order
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <Card className="p-4 glass-card border-none">
          <Calendar
            mode="single"
            selected={order.date && !isNaN(new Date(order.date).getTime()) ? new Date(order.date) : undefined}
            onSelect={(date) => {
              updateOrder({ date, timeSlot: null }); // Reset time slot when date changes
            }}
            className="rounded-md border-none text-white"
            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
          />
        </Card>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-brand-gold">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Available Slots</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {TIME_SLOTS.map((slot) => {
              const isFull = (slotCounts[slot] || 0) >= 2 || blockedSlots.includes(slot);
              const isSelected = order.timeSlot === slot;
              
              return (
                <button
                  key={slot}
                  disabled={isFull}
                  onClick={() => updateOrder({ timeSlot: slot })}
                  className={`py-3 px-2 rounded-xl text-xs font-medium transition-all border ${
                    isSelected
                      ? 'bg-brand-gold border-brand-gold text-brand-dark shadow-lg shadow-brand-gold/20'
                      : isFull
                      ? 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed line-through'
                      : 'bg-white/5 border-white/10 hover:border-white/20 text-white/70'
                  }`}
                >
                  {slot}
                  {isFull && <span className="block text-[10px] mt-1 text-red-400/70 no-underline">{blockedSlots.includes(slot) ? 'BLOCKED' : 'FULL'}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Button
        disabled={!order.date || !order.timeSlot}
        onClick={onNext}
        className="w-full h-14 rounded-2xl bg-white text-brand-dark hover:bg-brand-gold hover:text-brand-dark transition-all text-lg font-medium"
      >
        Continue
      </Button>
    </div>
  );
}

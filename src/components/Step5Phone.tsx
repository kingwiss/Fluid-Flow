import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OrderState } from '../types';
import { Phone, KeyRound, ArrowRight, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Props {
  order: OrderState;
  updateOrder: (updates: Partial<OrderState>) => void;
  onNext: () => void;
  isTrackingMode?: boolean;
  onOrdersFetched?: (orders: OrderState[]) => void;
}

export default function Step5Phone({ order, updateOrder, onNext, isTrackingMode, onOrdersFetched }: Props) {
  const [phone, setPhone] = useState(order.customerPhone || '');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = async (phone: string) => {
    let remoteOrders: OrderState[] = [];
    try {
      const q = query(collection(db, 'orders'), where('customerPhone', '==', phone));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        remoteOrders.push(doc.data() as OrderState);
      });
    } catch (error) {
      console.error("Error fetching orders from DB:", error);
    }

    // Fallback to local storage for persistence across reloads in development
    let localOrders: OrderState[] = [];
    try {
      localOrders = JSON.parse(localStorage.getItem(`fluidflow_orders_${phone}`) || '[]');
    } catch (e) {}

    // Merge by ID, preferring remote if available
    const merged = [...remoteOrders];
    for (const local of localOrders) {
      if (!merged.some(o => o.id === local.id)) {
        merged.push(local);
      }
    }
    
    // Sort descending by creation date
    return merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  };

  const handleSendOtp = async () => {
    if (!isTrackingMode && name.trim().length < 2) {
      toast.error('Please enter your name');
      return;
    }
    if (phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    setIsLoading(true);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;
      const response = await fetch((import.meta.env.VITE_API_URL || '') + '/api/sms/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone })
      });
      const data = await response.json();
      
      if (data.success) {
        if (data.isDevMode) {
          toast.info(`Development Mode: ${data.message}`);
          setIsLoading(false); // Clear before setting otp
          setOtp(data.otp);
          setStep('otp');
          toast(`Your temporary verification code is: ${data.otp}`, {
            duration: 10000,
            action: {
              label: 'Copy',
              onClick: () => {
                navigator.clipboard.writeText(data.otp);
                toast.success('Copied!');
              }
            }
          });
        } else {
          toast.success('OTP sent!');
          setStep('otp');
        }
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/sms/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, code: otp, name: name })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('Phone verified!');
        
        if (isTrackingMode) {
          const orders = await fetchOrders(formattedPhone);
          if (onOrdersFetched) {
            onOrdersFetched(orders);
          } else if (orders.length > 0) {
            updateOrder(orders[orders.length - 1]);
            onNext();
          } else {
            toast.error('No active orders found for this number');
          }
        } else {
          updateOrder({ customerPhone: formattedPhone, customerName: name } as any);
          const orders = await fetchOrders(formattedPhone);
          if (onOrdersFetched) {
            onOrdersFetched(orders);
          }
          onNext();
        }
      } else {
        toast.error(data.error || 'Invalid code');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-serif">{isTrackingMode ? 'Track Your Order' : 'Stay Updated'}</h2>
        <p className="text-white/50">
          {isTrackingMode 
            ? 'Enter your phone number to retrieve your active order.' 
            : 'Enter your name and phone number to receive live tracking updates and communicate with your driver.'}
        </p>
      </div>

      {step === 'phone' ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          {!isTrackingMode && (
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-brand-gold transition-colors" />
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                className="h-14 pl-12 pr-4 rounded-2xl bg-white/5 border-white/10 focus:border-brand-gold/50 focus:ring-brand-gold/20 transition-all text-lg"
              />
            </div>
          )}
          <div className="relative group">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-brand-gold transition-colors" />
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone Number (e.g. 555-123-4567)"
              className="h-14 pl-12 pr-4 rounded-2xl bg-white/5 border-white/10 focus:border-brand-gold/50 focus:ring-brand-gold/20 transition-all text-lg"
            />
          </div>
          <Button 
            onClick={handleSendOtp} 
            disabled={isLoading}
            className="w-full h-14 rounded-2xl bg-brand-gold text-brand-dark hover:bg-brand-gold/90 text-lg font-medium"
          >
            {isLoading ? 'Sending...' : 'Send Verification Code'}
            {!isLoading && <ArrowRight className="w-5 h-5 ml-2" />}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="relative group">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-brand-gold transition-colors" />
            <Input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              className="h-14 pl-12 pr-4 rounded-2xl bg-white/5 border-white/10 focus:border-brand-gold/50 focus:ring-brand-gold/20 transition-all text-lg tracking-widest text-center"
            />
          </div>
          <Button 
            onClick={handleVerifyOtp} 
            disabled={isLoading}
            className="w-full h-14 rounded-2xl bg-brand-gold text-brand-dark hover:bg-brand-gold/90 text-lg font-medium"
          >
            {isLoading ? 'Verifying...' : 'Verify & Continue'}
          </Button>
          <button 
            onClick={() => setStep('phone')}
            className="w-full text-center text-sm text-white/40 hover:text-white transition-colors pt-2"
          >
            Use a different number
          </button>
        </div>
      )}
    </div>
  );
}

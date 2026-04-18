import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, X, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { OrderState } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (phone: string, orders: OrderState[]) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: Props) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrders = async (phone: string) => {
    let remoteOrders: OrderState[] = [];
    try {
      // Using phone number instead of uid since we are using custom auth
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
    if (phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    setIsLoading(true);
    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;
      const res = await fetch('/api/sms/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message || 'OTP sent!');
        setStep('otp');
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
      const res = await fetch('/api/sms/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, code: otp })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('Successfully signed in!');
        const orders = await fetchOrders(formattedPhone);
        onLoginSuccess(formattedPhone, orders);
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
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-brand-dark border border-white/10 p-6 rounded-2xl shadow-2xl z-[101]"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-serif mb-2">Sign In</h2>
            <p className="text-white/50 text-sm mb-6">
              {step === 'phone' 
                ? 'Enter your phone number to access your dashboard and order history.'
                : `Enter the 6-digit code sent to ${phone}`}
            </p>

            {step === 'phone' ? (
              <div className="space-y-4">
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-brand-gold transition-colors" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="pl-12 h-14 bg-white/5 border-white/10 focus:border-brand-gold text-lg"
                  />
                </div>
                <Button 
                  onClick={handleSendOtp} 
                  disabled={isLoading}
                  className="w-full h-14 bg-brand-gold text-brand-dark hover:bg-brand-gold/90 text-lg font-bold"
                >
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Send Code'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-brand-gold transition-colors" />
                  <Input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="pl-12 h-14 bg-white/5 border-white/10 focus:border-brand-gold text-lg tracking-[0.5em] font-mono"
                  />
                </div>
                <Button 
                  onClick={handleVerifyOtp} 
                  disabled={isLoading}
                  className="w-full h-14 bg-brand-gold text-brand-dark hover:bg-brand-gold/90 text-lg font-bold"
                >
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Verify & Sign In'}
                </Button>
                <button 
                  onClick={() => setStep('phone')}
                  className="w-full text-center text-sm text-white/50 hover:text-white py-2"
                >
                  Use a different number
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

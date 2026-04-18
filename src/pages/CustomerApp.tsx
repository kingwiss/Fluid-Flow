import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { OrderState, INITIAL_ORDER_STATE } from '../types';
import Step1Schedule from '../components/Step1Schedule';
import Step2Choice from '../components/Step2Choice';
import Step3Details from '../components/Step3Details';
import Step4Addresses from '../components/Step4Addresses';
import Step5Phone from '../components/Step5Phone';
import Step6Review from '../components/Step5Review'; // Keeping filename same but component name updated in flow
import OrderHistory from '../components/OrderHistory';
import LoginModal from '../components/LoginModal';
import TermsOfService from './TermsOfService';
import PrivacyPolicy from './PrivacyPolicy';
import { ChevronLeft, Package, Clock, MapPin, CreditCard, Phone, User } from 'lucide-react';

export default function CustomerApp() {
  const [view, setView] = useState<'order' | 'track' | 'history' | 'privacy' | 'terms'>('order');
  const [order, setOrder] = useState<OrderState>(INITIAL_ORDER_STATE);
  const [orderHistory, setOrderHistory] = useState<OrderState[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loggedInPhone, setLoggedInPhone] = useState<string | null>(null);
  const navigate = useNavigate();
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true' || params.get('redirect_status') === 'succeeded') {
      const pendingOrder = localStorage.getItem('swift_drop_pending_order');
      if (pendingOrder) {
        try {
          const parsed = JSON.parse(pendingOrder);
          // Set to step 6 (Review) so we go straight back to checkout
          setOrder({ ...parsed, step: 6 });
          setView('order');
        } catch(e) {
          console.error('Failed to parse pending order', e);
        }
      }
    } else {
      // Check for abandoned order
      const abandoned = localStorage.getItem('fluidflow_abandoned_order');
      if (abandoned) {
        try {
          const parsed = JSON.parse(abandoned);
          if (parsed && parsed.step > 1 && !parsed.id) {
            toast('You have an incomplete order!', {
              duration: Infinity,
              action: {
                label: 'Resume Order',
                onClick: () => {
                  setOrder(parsed);
                  setView('order');
                  toast.dismiss();
                }
              },
              cancel: {
                label: 'Discard',
                onClick: () => {
                  localStorage.removeItem('fluidflow_abandoned_order');
                  toast.dismiss();
                }
              }
            });
          }
        } catch(e) {}
      }
    }
  }, []);

  // Track incomplete orders and schedule/cancel SMS reminders
  useEffect(() => {
    if (order.step > 1 && !order.id) {
      localStorage.setItem('fluidflow_abandoned_order', JSON.stringify(order));
      
      // If we have their phone, schedule the 30-min reminder
      if (order.customerPhone) {
        fetch('/api/sms/schedule-abandoned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: order.customerPhone })
        }).catch(() => {});
      }
    } else if (order.id) {
      // Order completed
      localStorage.removeItem('fluidflow_abandoned_order');
      
      if (order.customerPhone) {
        // Save to local development history as well
        const phoneKey = `fluidflow_orders_${order.customerPhone}`;
        try {
          const existing = JSON.parse(localStorage.getItem(phoneKey) || '[]');
          if (!existing.some((o: OrderState) => o.id === order.id)) {
            const updatedHistory = [order, ...existing];
            localStorage.setItem(phoneKey, JSON.stringify(updatedHistory));
            setOrderHistory(prev => {
              if (!prev.some(o => o.id === order.id)) {
                return [order, ...prev];
              }
              return prev;
            });
          }
        } catch(e) {}

        fetch('/api/sms/cancel-abandoned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: order.customerPhone })
        }).catch(() => {});
      }
    }
  }, [order]);

  // Auto-login when phone is verified during order flow
  useEffect(() => {
    if (order.customerPhone && !loggedInPhone) {
      setLoggedInPhone(order.customerPhone);
    }
  }, [order.customerPhone, loggedInPhone]);

  const handleLogoClick = () => {
    clickCountRef.current += 1;
    if (clickCountRef.current >= 3) {
      navigate('/driver');
      clickCountRef.current = 0;
    }
    
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1000); // Reset clicks if not tapped 3 times within 1 second
  };

  const nextStep = () => setOrder(prev => ({ ...prev, step: prev.step + 1 }));
  const prevStep = () => setOrder(prev => ({ ...prev, step: Math.max(1, prev.step - 1) }));

  const updateOrder = (updates: Partial<OrderState>) => {
    setOrder(prev => ({ ...prev, ...updates }));
  };

  const steps = [
    { icon: Clock, label: 'Schedule' },
    { icon: Package, label: 'Order' },
    { icon: Package, label: 'Details' },
    { icon: MapPin, label: 'Route' },
    { icon: Phone, label: 'Phone' },
    { icon: CreditCard, label: 'Review' },
  ];

  return (
    <div className="min-h-screen bg-brand-dark text-white selection:bg-brand-gold/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-brand-dark/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          {view === 'order' && order.step > 1 && (
            <button 
              onClick={prevStep}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {(view === 'track' || view === 'history') && (
            <button 
              onClick={() => setView('order')}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h1 
            onClick={handleLogoClick}
            className="text-xl font-serif italic tracking-tight cursor-pointer select-none"
          >
            FluidFlow
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          {view === 'order' && (
            <div className="hidden sm:flex gap-2 mr-4">
              {steps.map((s, i) => (
                <div 
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    i + 1 === order.step ? 'bg-brand-gold w-6' : i + 1 < order.step ? 'bg-brand-gold/40' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          )}
          
          {loggedInPhone ? (
            <button 
              onClick={() => setView('history')}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-colors text-sm font-medium"
            >
              <User className="w-4 h-4 text-brand-gold" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          ) : (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand-gold text-brand-dark hover:bg-brand-gold/90 rounded-full transition-colors text-sm font-bold"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <main className="pt-24 pb-12 px-6 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {view === 'terms' ? (
            <motion.div
              key="terms"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <TermsOfService onBack={() => setView('order')} />
            </motion.div>
          ) : view === 'privacy' ? (
            <motion.div
              key="privacy"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <PrivacyPolicy onBack={() => setView('order')} />
            </motion.div>
          ) : view === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <OrderHistory 
                orders={orderHistory} 
                onSelectOrder={(selectedOrder) => {
                  setOrder({ ...selectedOrder, step: 6 });
                  setView('order');
                }}
                onBack={() => setView('order')}
              />
            </motion.div>
          ) : view === 'track' ? (
            <motion.div
              key="track"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Step5Phone 
                order={order} 
                updateOrder={(updates) => {
                  updateOrder(updates);
                }} 
                onOrdersFetched={(orders) => {
                  if (orders.length > 0) {
                    // Sort orders by createdAt descending
                    const sortedOrders = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    setOrderHistory(sortedOrders);
                    setView('history');
                  } else {
                    // Fallback to order view if no orders found
                    setView('order');
                  }
                }}
                onNext={() => {
                  // This is handled by onOrdersFetched now
                }} 
                isTrackingMode={true}
              />
            </motion.div>
          ) : (
            <motion.div
              key={order.step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {order.step === 1 && (
              <Step1Schedule 
                order={order} 
                updateOrder={updateOrder} 
                onNext={nextStep} 
                onTrackOrder={() => setView('track')} 
              />
            )}
            {order.step === 2 && (
              <Step2Choice order={order} updateOrder={updateOrder} onNext={nextStep} />
            )}
            {order.step === 3 && (
              <Step3Details order={order} updateOrder={updateOrder} onNext={nextStep} />
            )}
            {order.step === 4 && (
              <Step4Addresses 
                order={order} 
                updateOrder={updateOrder} 
                onNext={nextStep} 
                onViewHistory={() => {
                  if (!loggedInPhone) {
                    setIsLoginModalOpen(true);
                  } else {
                    setView('history');
                  }
                }}
              />
            )}
            {order.step === 5 && (
              <Step5Phone 
                order={order} 
                updateOrder={updateOrder} 
                onNext={nextStep} 
                onOrdersFetched={(orders) => {
                  const sortedOrders = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                  setOrderHistory(sortedOrders);
                }}
              />
            )}
            {order.step === 6 && (
              <Step6Review order={order} updateOrder={updateOrder} />
            )}
          </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Toaster position="top-center" theme="dark" />
      
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onLoginSuccess={(phone, orders) => {
          setLoggedInPhone(phone);
          const sortedOrders = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setOrderHistory(sortedOrders);
          setIsLoginModalOpen(false);
          setView('history');
        }}
      />
      
      <footer className="w-full text-center p-6 text-xs text-white/40 flex justify-center gap-4 border-t border-white/5 bg-brand-dark/50">
        <button onClick={() => setView('terms')} className="hover:text-brand-gold transition-colors">Terms of Service</button>
        <button onClick={() => setView('privacy')} className="hover:text-brand-gold transition-colors">Privacy Policy</button>
      </footer>
    </div>
  );
}

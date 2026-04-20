import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripeCheckout from './StripeCheckout';
import PayPalCheckout from './PayPalCheckout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { OrderState } from '../types';
import { format } from 'date-fns';
import { 
  CreditCard, 
  Wallet, 
  MapPin, 
  Clock, 
  Package, 
  Receipt, 
  ChevronRight,
  ShieldCheck,
  Info,
  Navigation,
  MessageSquare,
  Phone,
  X,
  Send,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Custom SVG Icons
const carSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
const forkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`;
const homeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

const createIcon = (svg: string, bgClass: string, textClass: string) => L.divIcon({
  html: `<div class="flex items-center justify-center w-8 h-8 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] ${bgClass} ${textClass}">${svg}</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const carIcon = createIcon(carSvg, 'bg-brand-gold', 'text-brand-dark');
const pickupIcon = createIcon(forkSvg, 'bg-white', 'text-brand-dark');
const dropoffIcon = createIcon(homeSvg, 'bg-brand-dark border border-brand-gold', 'text-brand-gold');

// Fix for default Leaflet icon in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to recenter map
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface Props {
  order: OrderState;
  updateOrder: (updates: Partial<OrderState>) => void;
}

export default function Step5Review({ order, updateOrder }: Props) {
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [driverPhase, setDriverPhase] = useState<'idle' | 'to_pickup' | 'at_pickup' | 'to_dropoff' | 'completed'>('idle');
  const [liveRoute, setLiveRoute] = useState<[number, number][]>([]);

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const orderIdRef = useRef<string | null>(null);

  const [foodCost, setFoodCost] = useState<number | null>(null);
  const [foodCostPaid, setFoodCostPaid] = useState(false);
  
  // Prompt for food payment
  useEffect(() => {
    if (foodCost && !foodCostPaid && driverPhase !== 'completed') {
       toast.info('Driver requested payment for your items. Please check the order slip to pay.');
    }
  }, [foodCost, foodCostPaid]);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [totalTip, setTotalTip] = useState(0);
  const [selectedTip, setSelectedTip] = useState(0);
  const [orderCreatedAt, setOrderCreatedAt] = useState<number | null>(null);
  const [paymentIntent, setPaymentIntent] = useState<{clientSecret: string, amount: number, type: 'initial' | 'food' | 'tip'} | null>(null);
  const [paypalIntent, setPaypalIntent] = useState<{amount: number, type: 'initial' | 'food' | 'tip'} | null>(null);

  const tipOptions = [0, 2, 5, 10];

  // Persist order in local storage for Stripe/PayPal redirects
  useEffect(() => {
    // We want to persist it both before it's placed AND after it's placed
    // because if they are doing a sub-payment (food cost, tip) and get redirected,
    // we need to be able to restore the order they were looking at!
    if (order.status || order.deliveryAddress) {
      localStorage.setItem('swift_drop_pending_order', JSON.stringify({ ...order, tip: totalTip }));
    }
  }, [order, totalTip]);

  // Handle Return from Stripe Redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true' || params.get('redirect_status') === 'succeeded') {
      const intentId = params.get('payment_intent') || undefined;
      const paymentType = localStorage.getItem('swift_drop_payment_type') || 'initial';
      
      setTimeout(() => {
        // Double check it hasn't been processed yet by another render iteration
        if (window.location.search.includes('payment_success') || window.location.search.includes('redirect_status')) {
          const isPlaced = orderIdRef.current !== null || isOrderPlaced;
          
          if (paymentType === 'initial' && !isPlaced) {
            handlePaymentSuccess(intentId);
          } else if (paymentType === 'food') {
            handleFoodPaymentSuccess();
          } else if (paymentType === 'tip') {
            const amountStored = localStorage.getItem('swift_drop_pending_tip');
            if (amountStored && !isNaN(Number(amountStored))) {
              handleTipPaymentSuccess(Number(amountStored));
            } else {
              toast.success('Tip sent successfully via redirect!');
            }
          }
          
          localStorage.removeItem('swift_drop_payment_type');
          localStorage.removeItem('swift_drop_pending_tip');
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }, 500);
    }
  }, [isOrderPlaced]);

  useEffect(() => {
    if (order.id && !isOrderPlaced) {
      setIsOrderPlaced(true);
      orderIdRef.current = order.id;
    }
  }, [order.id, isOrderPlaced]);

  // Fetch chat messages
  useEffect(() => {
    if (!isOrderPlaced || !orderIdRef.current) return;
    
    const fetchMessages = async () => {
      try {
        if (!orderIdRef.current) return;
        const encodedId = encodeURIComponent(orderIdRef.current.trim());
        const res = await fetch(`/api/chat/${encodedId}`);
        const data = await res.json();
        if (data.messages) {
          setMessages(data.messages);
        }
      } catch (err) {
        console.error('Failed to fetch messages', err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [isOrderPlaced]);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !orderIdRef.current) return;
    
    const text = newMessage;
    setNewMessage('');
    
    try {
      const encodedId = encodeURIComponent(orderIdRef.current.trim());
      await fetch(`/api/chat/${encodedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: 'customer', text })
      });
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  useEffect(() => {
    if (!isOrderPlaced || !orderIdRef.current) return;

    const unsubscribe = onSnapshot(doc(db, 'orders', orderIdRef.current), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.status) {
          setDriverPhase(data.status);
        }
        if (data.foodCost !== undefined) {
          setFoodCost(data.foodCost);
        }
        if (data.foodCostPaid !== undefined) {
          setFoodCostPaid(data.foodCostPaid);
        }
        if (data.receiptImage !== undefined) {
          setReceiptImage(data.receiptImage);
        }
        if (data.tip !== undefined) {
          setTotalTip(data.tip);
        }
        if (data.createdAt) {
          setOrderCreatedAt(data.createdAt);
        }
      }
    });

    return () => unsubscribe();
  }, [isOrderPlaced]);

  useEffect(() => {
    if (isOrderPlaced && orderIdRef.current) {
      setDoc(doc(db, 'orders', orderIdRef.current), { tip: totalTip }, { merge: true });
    }
  }, [totalTip, isOrderPlaced]);

  useEffect(() => {
    if (!isOrderPlaced) return;

    // Subscribe to driver location updates via localStorage (cross-tab communication)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'driver_location' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.lat && data.lng) {
            setDriverLocation([data.lat, data.lng]);
          }
          if (data.phase) {
            setDriverPhase(data.phase);
          }
        } catch (err) {
          console.error('Failed to parse driver location', err);
        }
      }
    };

    // Also check on mount/interval in case they are in the same tab or missed the event
    const checkLocation = () => {
      const loc = localStorage.getItem('driver_location');
      if (loc) {
        try {
          const data = JSON.parse(loc);
          // Only use if updated in the last 5 minutes
          if (data.lat && data.lng && Date.now() - data.timestamp < 300000) {
            setDriverLocation([data.lat, data.lng]);
          }
          if (data.phase) {
            setDriverPhase(data.phase);
          }
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(checkLocation, 2000);
    checkLocation();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isOrderPlaced]);

  // Fetch live route geometry when driver location updates
  useEffect(() => {
    if (!isOrderPlaced || !driverLocation || !order.pickupCoords || !order.deliveryCoords) return;

    const fetchRoute = async () => {
      try {
        let waypoints = [];
        if (driverPhase === 'to_pickup') {
          waypoints = [
            { lat: driverLocation[0], lon: driverLocation[1] },
            { lat: order.pickupCoords!.lat, lon: order.pickupCoords!.lon }
          ];
        } else if (driverPhase === 'to_dropoff') {
          waypoints = [
            { lat: driverLocation[0], lon: driverLocation[1] },
            { lat: order.deliveryCoords!.lat, lon: order.deliveryCoords!.lon }
          ];
        } else {
          // Default full route if phase is unknown or idle
          waypoints = [
            { lat: driverLocation[0], lon: driverLocation[1] },
            { lat: order.pickupCoords!.lat, lon: order.pickupCoords!.lon },
            { lat: order.deliveryCoords!.lat, lon: order.deliveryCoords!.lon }
          ];
        }

        const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waypoints })
        });
        const data = await res.json();
        if (data.route) {
          setLiveRoute(data.route);
        }
      } catch (err) {
        console.error('Failed to fetch live route:', err);
      }
    };

    // Throttle route fetching to avoid spamming OSRM
    const timeoutId = setTimeout(fetchRoute, 5000);
    return () => clearTimeout(timeoutId);
  }, [driverLocation, driverPhase, isOrderPlaced, order.pickupCoords, order.deliveryCoords]);

  const handlePayment = async (method: 'stripe' | 'paypal') => {
    if (method === 'stripe') {
      toast.loading('Preparing payment...');
      try {
        const response = await fetch((import.meta.env.VITE_API_URL || '') + '/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: totalFee, currency: 'usd' })
        });
        
        if (!response.ok) throw new Error('Failed to create payment intent');
        
        const { clientSecret } = await response.json();
        toast.dismiss();
        
        localStorage.setItem('swift_drop_payment_type', 'initial');
        setPaymentIntent({ clientSecret, amount: totalFee, type: 'initial' });
      } catch (err) {
        toast.dismiss();
        toast.error('Payment failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } else if (method === 'paypal') {
      setPaypalIntent({ amount: totalFee, type: 'initial' });
    }
  };

  const handleFoodPayment = async (method: 'stripe' | 'paypal') => {
    if (method === 'stripe') {
      if (foodCost === null) return;
      toast.loading('Preparing payment...');
      try {
        const response = await fetch((import.meta.env.VITE_API_URL || '') + '/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: foodCost, currency: 'usd' })
        });
        
        if (!response.ok) throw new Error('Failed to create payment intent');
        
        const { clientSecret } = await response.json();
        toast.dismiss();
        
        localStorage.setItem('swift_drop_payment_type', 'food');
        setPaymentIntent({ clientSecret, amount: foodCost, type: 'food' });
      } catch (err) {
        toast.dismiss();
        toast.error('Payment failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } else if (method === 'paypal') {
      if (foodCost === null) return;
      localStorage.setItem('swift_drop_payment_type', 'food');
      setPaypalIntent({ amount: foodCost, type: 'food' });
    }
  };

  const handleFoodPaymentSuccess = () => {
    toast.success('Food payment successful!');
    if (orderIdRef.current) {
      setDoc(doc(db, 'orders', orderIdRef.current), { foodCostPaid: true }, { merge: true });
    }
  };

  const handleTipPayment = async (method: 'stripe' | 'paypal', amount: number) => {
    if (amount <= 0) return;
    
    if (method === 'stripe') {
      toast.loading('Preparing tip payment...');
      try {
        const response = await fetch((import.meta.env.VITE_API_URL || '') + '/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amount, currency: 'usd' })
        });
        
        if (!response.ok) throw new Error('Failed to create payment intent');
        
        const { clientSecret } = await response.json();
        toast.dismiss();
        
        localStorage.setItem('swift_drop_payment_type', 'tip');
        localStorage.setItem('swift_drop_pending_tip', amount.toString());
        setPaymentIntent({ clientSecret, amount: amount, type: 'tip' });
      } catch (err) {
        toast.dismiss();
        toast.error('Payment failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } else if (method === 'paypal') {
      localStorage.setItem('swift_drop_payment_type', 'tip');
      localStorage.setItem('swift_drop_pending_tip', amount.toString());
      setPaypalIntent({ amount: amount, type: 'tip' });
    }
  };

  const handleTipPaymentSuccess = (amount: number) => {
    toast.success(`Tip of $${amount.toFixed(2)} sent successfully!`);
    if (orderIdRef.current) {
      // Update the tip amount in Firestore
      const newTip = totalTip + amount;
      setTotalTip(newTip);
      setSelectedTip(0);
      setDoc(doc(db, 'orders', orderIdRef.current), { tip: newTip }, { merge: true });
    }
  };
  const handlePaymentSuccess = (paymentId?: string, isPayPal: boolean = false) => {
    toast.success('Payment successful! Your courier is on the way.');
    setIsOrderPlaced(true);

    // Broadcast new order to Driver Dashboard
    const newDelivery = {
      id: 'ORD-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
      time: 'Just Now',
      pickup: order.pickupAddress,
      pickupCoords: order.pickupCoords,
      pickupNotes: order.pickupNotes,
      delivery: order.deliveryAddress,
      deliveryCoords: order.deliveryCoords,
      deliveryNotes: order.deliveryNotes,
      details: order.orderDetails || 'Standard delivery',
      receiptImage: order.receiptImage,
      status: 'pending',
      payout: '$' + (order.deliveryFee * 0.8).toFixed(2),
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      tip: selectedTip
    };
    
    orderIdRef.current = newDelivery.id;
    setTotalTip(selectedTip); // commit tip to total once initial order is placed
    
    const orderToSave = { 
      ...order, 
      id: newDelivery.id, 
      createdAt: Date.now(),
      dateString: order.date && !isNaN(new Date(order.date).getTime()) ? format(new Date(order.date), 'yyyy-MM-dd') : null,
      orderType: order.status,
      status: 'pending',
      tip: selectedTip,
      stripePaymentIntentId: !isPayPal ? (paymentId || null) : null,
      paypalCaptureId: isPayPal ? (paymentId || null) : null
    };

    // Update parent order state so it knows the order is placed
    updateOrder({ id: newDelivery.id, createdAt: orderToSave.createdAt, tip: selectedTip });

    // Save to Firestore
    setDoc(doc(db, 'orders', newDelivery.id), orderToSave).catch(console.error);

    localStorage.setItem('swift_drop_new_order', JSON.stringify(newDelivery));
    localStorage.removeItem('swift_drop_pending_order');
    localStorage.removeItem('fluidflow_abandoned_order');
  };

  const handleCancelOrderClick = () => {
    // Check if driver has already started
    if (driverPhase !== 'pending' && driverPhase !== 'idle' && driverPhase !== undefined) {
      toast.error('Cannot cancel: Driver has already started this order.');
      return;
    }

    if (orderCreatedAt && Date.now() - orderCreatedAt > 90 * 60 * 1000) {
      toast.error('Cannot cancel: Orders can only be cancelled within 1.5 hours of placement.');
      return;
    }

    setCancelModalOpen(true);
  };

  const confirmCancelOrder = async () => {
    if (!orderIdRef.current) return;
    setCancelModalOpen(false);

    toast.loading('Cancelling order and processing refund...');
    try {
      const res = await fetch(`/api/orders/${orderIdRef.current}/cancel`, {
        method: 'POST'
      });
      const data = await res.json();
      
      toast.dismiss();
      if (data.success) {
        toast.success('Order cancelled and refund issued successfully.');
        setDriverPhase('cancelled_refunded');
      } else {
        toast.error(data.error || 'Failed to cancel order.');
      }
    } catch (err) {
      toast.dismiss();
      toast.error('Failed to cancel order.');
    }
  };

  const totalFee = order.deliveryFee + 2.50 - (order.appliedCoupon?.discount === 'free_delivery' ? order.deliveryFee : (typeof order.appliedCoupon?.discount === 'number' ? order.deliveryFee * order.appliedCoupon.discount : 0)) + totalTip;

  const mapboxKey = (import.meta as any).env.VITE_MAPBOX_API_KEY;
  const tileUrl = mapboxKey 
    ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${mapboxKey}`
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-serif">Order Slip & Tracking</h2>
        <p className="text-white/50">
          {(!driverPhase || driverPhase === 'pending' || driverPhase === 'idle') && 'Waiting for driver to begin...'}
          {driverPhase === 'to_pickup' && 'Courier is heading to the pickup location.'}
          {driverPhase === 'at_pickup' && 'Courier is at the pickup location.'}
          {driverPhase === 'to_dropoff' && 'Courier is heading your way!'}
          {driverPhase === 'at_dropoff' && 'Courier has arrived at your location!'}
          {driverPhase === 'completed' && 'Your order has been delivered!'}
          {driverPhase === 'cancelled_refunded' && 'Your order was cancelled and refunded.'}
        </p>
      </div>

      <Card className="overflow-hidden rounded-2xl border-white/10 shadow-2xl h-64 relative z-0">
        <MapContainer 
          center={driverLocation || (order.pickupCoords ? [order.pickupCoords.lat, order.pickupCoords.lon] : [39.9526, -75.1652])} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url={tileUrl}
          />
          {driverLocation && <MapUpdater center={driverLocation} />}
          
          {liveRoute.length > 0 && (
            <Polyline positions={liveRoute} color="#D4AF37" weight={4} opacity={0.8} />
          )}

          {driverLocation && (
            <Marker position={driverLocation} icon={carIcon}>
              <Popup>Courier is here</Popup>
            </Marker>
          )}
          {order.pickupCoords && (
            <Marker position={[order.pickupCoords.lat, order.pickupCoords.lon]} icon={pickupIcon}>
              <Popup>Restaurant (Pickup)</Popup>
            </Marker>
          )}
          {order.deliveryCoords && (
            <Marker position={[order.deliveryCoords.lat, order.deliveryCoords.lon]} icon={dropoffIcon}>
              <Popup>Customer Home (Dropoff)</Popup>
            </Marker>
          )}
        </MapContainer>
        <div className="absolute bottom-4 left-4 right-4 z-[1000] p-3 bg-brand-dark/90 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-3">
          <div className={`p-2 rounded-full ${driverLocation ? 'bg-brand-gold/20 text-brand-gold animate-pulse' : 'bg-white/10 text-white/40'}`}>
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white uppercase tracking-wider">Courier Status</p>
            <p className="text-[10px] text-white/60">
              {driverPhase === 'idle' && 'Waiting for courier to start...'}
              {driverPhase === 'to_pickup' && 'Heading to restaurant...'}
              {driverPhase === 'at_pickup' && 'Picking up order...'}
              {driverPhase === 'to_dropoff' && 'Heading to your location...'}
              {driverPhase === 'at_dropoff' && 'Courier has arrived...'}
              {driverPhase === 'completed' && 'Delivered successfully'}
            </p>
          </div>
        </div>
      </Card>

      {/* Virtual Order Slip */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative"
      >
        <div className="absolute -top-2 left-4 right-4 h-4 bg-white/90 rounded-t-xl z-0" />
        
        <Card className="relative z-10 bg-white text-brand-dark rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-6 bg-brand-gold/10 border-b border-brand-gold/20 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">Order Receipt</p>
              <p className="text-xs font-mono text-brand-dark/40">#{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            </div>
            <Badge variant="outline" className={`border-brand-gold font-bold ${isOrderPlaced ? 'bg-brand-gold text-brand-dark' : 'text-brand-gold'}`}>
              {isOrderPlaced ? 'IN PROGRESS' : 'PENDING'}
            </Badge>
          </div>

          <div className="p-8 space-y-6 font-mono text-sm">
            {/* Schedule */}
            <div className="flex justify-between items-start gap-4">
              <div className="flex gap-3">
                <Clock className="w-4 h-4 text-brand-dark/40 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-brand-dark/40">Delivery Window</p>
                  <p className="font-medium">{order.date && !isNaN(new Date(order.date).getTime()) ? format(new Date(order.date), 'MMM dd, yyyy') : 'Today'} at {order.timeSlot}</p>
                </div>
              </div>
            </div>

            <Separator className="bg-brand-dark/5" />

            {/* Route */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center gap-1 mt-1">
                  <div className="w-2 h-2 rounded-full bg-brand-gold" />
                  <div className="w-0.5 h-8 bg-brand-dark/10" />
                  <MapPin className="w-3 h-3 text-brand-dark/40" />
                </div>
                <div className="space-y-4 flex-1">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-brand-dark/40">Pickup</p>
                    <p className="font-medium truncate">{order.pickupAddress}</p>
                    {order.pickupNotes && (
                      <p className="text-xs text-brand-dark/60 italic mt-1 bg-brand-dark/5 p-2 rounded-md">Note: {order.pickupNotes}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-brand-dark/40">Delivery</p>
                    <p className="font-medium truncate">{order.deliveryAddress}</p>
                    {order.deliveryNotes && (
                      <p className="text-xs text-brand-dark/60 italic mt-1 bg-brand-dark/5 p-2 rounded-md">Note: {order.deliveryNotes}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator className="bg-brand-dark/5" />

            {/* Order Content */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-dark/40" />
                <p className="text-[10px] font-bold uppercase text-brand-dark/40">Order Details</p>
              </div>
              <div className="p-4 rounded-xl bg-brand-dark/5 border border-brand-dark/5 italic text-xs leading-relaxed">
                {order.status === 'already_ordered' ? (
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    <span>Receipt Uploaded (Pre-paid)</span>
                  </div>
                ) : (
                  <p>{order.orderDetails}</p>
                )}
              </div>
              {order.needsPhoneCall && (
                <div className="flex items-center gap-2 text-[10px] text-brand-gold font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>PHONE CALL REQUESTED</span>
                </div>
              )}
            </div>

            {/* Pricing */}
            <div className="pt-4 space-y-2 border-t border-dashed border-brand-dark/20">
              <div className="flex justify-between items-center text-xs">
                <span className="text-brand-dark/60">Delivery Fee (Calculated)</span>
                <span>${order.deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-brand-dark/60">Service Fee</span>
                <span>$2.50</span>
              </div>
              {order.appliedCoupon && (
                <div className="flex justify-between items-center text-xs text-green-600 font-bold">
                  <span>Discount ({order.appliedCoupon.code})</span>
                  <span>
                    {order.appliedCoupon.discount === 'free_delivery' 
                      ? `-$${order.deliveryFee.toFixed(2)}` 
                      : `-$${(order.deliveryFee * (order.appliedCoupon.discount as number)).toFixed(2)}`}
                  </span>
                </div>
              )}
              {!isOrderPlaced && (
                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase text-brand-dark/40 mb-2">Add a Tip</p>
                  <div className="flex gap-2">
                    {tipOptions.map(option => (
                      <button
                        key={option}
                        onClick={() => setSelectedTip(option)}
                        className={`flex-1 h-10 rounded-md flex items-center justify-center text-sm font-medium transition-colors border ${
                          selectedTip === option 
                            ? 'bg-brand-gold border-brand-gold text-brand-dark shadow-sm' 
                            : 'bg-transparent border-brand-dark/20 text-brand-dark hover:bg-brand-dark/5'
                        }`}
                      >
                        ${option}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center text-lg font-bold pt-2">
                <span>Total Due</span>
                <span className="text-brand-gold">${totalFee.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="h-2 bg-[radial-gradient(circle_at_center,_#000_1px,_transparent_1px)] bg-[length:8px_8px] opacity-10" />
        </Card>
      </motion.div>

      {!isOrderPlaced && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 text-brand-gold">
            <Info className="w-5 h-5 shrink-0" />
            <p className="text-xs leading-relaxed">
              {order.status === 'order_for_me' 
                ? "You'll pay for the food items once we arrive at the restaurant and confirm the final price."
                : "Only the delivery fee is due now as you've already paid for your order."}
            </p>
          </div>

          <div className="grid gap-3">
            <Button
              onClick={() => handlePayment('stripe')}
              className="w-full h-16 rounded-2xl bg-brand-dark text-white hover:bg-brand-muted transition-all flex items-center justify-between px-6 group"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-brand-gold" />
                <span className="font-medium">Pay with Stripe</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </Button>

            <Button
              onClick={() => handlePayment('paypal')}
              variant="outline"
              className="w-full h-16 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all flex items-center justify-between px-6 group"
            >
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-[#0070ba]" />
                <span className="font-medium">PayPal Checkout</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </Button>
          </div>
        </div>
      )}

      {isOrderPlaced && foodCost !== null && !foodCostPaid && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <h3 className="font-bold mb-1 flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Food Payment Required
            </h3>
            <p className="text-sm">Your driver has arrived at the restaurant. The total cost of your food is <strong className="text-red-300">${foodCost.toFixed(2)}</strong>. Please pay this amount so the driver can complete the order.</p>
            {receiptImage && (
              <div className="mt-3">
                <p className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">Receipt from Driver</p>
                <img src={receiptImage} alt="Receipt" className="rounded-lg max-h-48 object-cover border border-red-500/20" />
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <Button
              onClick={() => handleFoodPayment('stripe')}
              className="w-full h-16 rounded-2xl bg-brand-dark text-white hover:bg-brand-muted transition-all flex items-center justify-between px-6 group"
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-brand-gold" />
                <span className="font-medium">Pay ${foodCost.toFixed(2)} with Stripe</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </Button>
            
            <Button
              onClick={() => handleFoodPayment('paypal')}
              variant="outline"
              className="w-full h-16 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all flex items-center justify-between px-6 group"
            >
              <div className="flex items-center gap-3">
                <Wallet className="w-5 h-5 text-[#0070ba]" />
                <span className="font-medium">Pay ${foodCost.toFixed(2)} with PayPal</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
            </Button>
          </div>
        </div>
      )}

      {isOrderPlaced && foodCost !== null && foodCostPaid && (
        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-3 animate-in fade-in">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">Food cost (${foodCost.toFixed(2)}) has been paid successfully.</p>
        </div>
      )}

      {isOrderPlaced && driverPhase !== 'cancelled_refunded' && (
        <div className="p-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 text-white space-y-4 animate-in fade-in">
          <div className="flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2 text-brand-gold">
              <DollarSign className="w-4 h-4" />
              Tip Your Driver
            </h3>
            {totalTip > 0 && <span className="text-sm font-bold text-brand-gold">Tipped: ${totalTip.toFixed(2)}</span>}
          </div>
          <p className="text-sm text-white/70">You can add a tip for your driver at any time.</p>
          
          <div className="space-y-3">
            <div className="flex gap-2">
              {[2, 5, 10, 20].map(option => (
                <Button
                  key={option}
                  variant={selectedTip === option ? 'default' : 'outline'}
                  onClick={() => setSelectedTip(option)}
                  className={`flex-1 h-10 ${selectedTip === option ? 'bg-brand-gold text-brand-dark hover:bg-brand-gold/90' : 'border-white/20 text-white hover:bg-white/10 hover:text-white'}`}
                >
                  ${option}
                </Button>
              ))}
            </div>
            
            {selectedTip > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  onClick={() => handleTipPayment('stripe', selectedTip)}
                  className="w-full h-10 rounded-xl bg-white text-brand-dark hover:bg-white/90 transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4 text-brand-gold" />
                  <span className="font-medium text-xs">Stripe</span>
                </Button>
                
                <Button
                  onClick={() => handleTipPayment('paypal', selectedTip)}
                  variant="outline"
                  className="w-full h-10 rounded-xl border-white/20 bg-transparent text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Wallet className="w-4 h-4 text-[#0070ba] brightness-150" />
                  <span className="font-medium text-xs">PayPal</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {isOrderPlaced && (!driverPhase || driverPhase === 'pending' || driverPhase === 'idle') && 
        (orderCreatedAt === null || Date.now() - orderCreatedAt <= 90 * 60 * 1000) && (
        <div className="pt-4 animate-in fade-in">
          <Button 
            onClick={handleCancelOrderClick}
            variant="outline"
            className="w-full h-14 rounded-2xl border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all font-medium"
          >
            Cancel Order & Request Refund
          </Button>
          <p className="text-xs text-center text-white/40 mt-3">
            You can cancel for a full refund within 1.5 hours of placing the order, as long as the driver hasn't started.
          </p>
        </div>
      )}

      {isOrderPlaced && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
          <Button 
            onClick={() => window.open('tel:[DRIVER_PHONE_NUMBER]')} // Replace with real driver phone number
            className="w-14 h-14 rounded-full bg-green-500 text-white shadow-lg shadow-green-500/20 hover:scale-105 transition-transform"
          >
            <Phone className="w-6 h-6" />
          </Button>
          <Button 
            onClick={() => setIsChatOpen(true)}
            className="w-14 h-14 rounded-full bg-brand-gold text-brand-dark shadow-lg shadow-brand-gold/20 hover:scale-105 transition-transform"
          >
            <MessageSquare className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Chat Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-brand-dark border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[500px] max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-gold" />
                Chat with Driver
              </h3>
              <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/40 text-sm">
                  No messages yet. Say hi!
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      msg.sender === 'customer' 
                        ? 'bg-brand-gold text-brand-dark rounded-br-sm' 
                        : 'bg-white/10 text-white rounded-bl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-4 border-t border-white/10 bg-white/5 flex gap-2">
              <Input 
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-white/5 border-white/10 focus:border-brand-gold/50"
              />
              <Button onClick={handleSendMessage} className="bg-brand-gold text-brand-dark hover:bg-brand-gold/90 px-3">
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setCancelModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-brand-dark border border-white/10 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4 text-white">Cancel Order?</h3>
            <p className="text-white/70 mb-8">
              Are you sure you want to cancel this order? You will be refunded to your original payment method.
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={() => setCancelModalOpen(false)}
                className="flex-1 h-12 bg-white/5 hover:bg-white/10 text-white rounded-xl"
              >
                No, Keep it
              </Button>
              <Button 
                onClick={confirmCancelOrder}
                className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium"
              >
                Yes, Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Payment Modal */}
      {paymentIntent && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setPaymentIntent(null)}
        >
          <div 
            className="w-full max-w-md bg-brand-dark border border-white/10 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setPaymentIntent(null)} 
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-brand-gold" />
              Complete Payment
            </h3>
            <Elements 
              stripe={stripePromise} 
              options={{ 
                clientSecret: paymentIntent.clientSecret,
                appearance: { theme: 'night', variables: { colorPrimary: '#FFD700' } }
              }}
            >
              <StripeCheckout 
                amount={paymentIntent.amount}
                onCancel={() => setPaymentIntent(null)}
                onSuccess={() => {
                  setPaymentIntent(null);
                  if (paymentIntent.type === 'initial') {
                    handlePaymentSuccess(paymentIntent.clientSecret);
                  } else if (paymentIntent.type === 'food') {
                    handleFoodPaymentSuccess();
                  } else if (paymentIntent.type === 'tip') {
                    handleTipPaymentSuccess(paymentIntent.amount);
                  }
                }}
              />
            </Elements>
          </div>
        </div>
      )}

      {/* PayPal Payment Modal */}
      {paypalIntent && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setPaypalIntent(null)}
        >
          <div 
            className="w-full max-w-md bg-brand-dark border border-white/10 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setPaypalIntent(null)} 
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-[#0070ba]" />
              Complete with PayPal
            </h3>
            <PayPalCheckout 
              amount={paypalIntent.amount}
              onCancel={() => setPaypalIntent(null)}
              onSuccess={(captureId) => {
                setPaypalIntent(null);
                if (paypalIntent.type === 'initial') {
                  handlePaymentSuccess(captureId, true);
                } else if (paypalIntent.type === 'food') {
                  handleFoodPaymentSuccess();
                } else if (paypalIntent.type === 'tip') {
                  handleTipPaymentSuccess(paypalIntent.amount);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

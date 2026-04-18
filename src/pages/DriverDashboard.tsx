import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, ShieldCheck, Activity, AlertTriangle, Package, CheckCircle2, ArrowLeft, ExternalLink, Clock, DollarSign, MessageSquare, Phone, X, Send, Utensils, Home, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { collection, onSnapshot, query, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';

// Fix for default Leaflet marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const RestaurantIcon = L.divIcon({
  html: `<div class="bg-brand-gold p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>`,
  className: 'custom-icon',
  iconSize: [30, 30],
});

const HouseIcon = L.divIcon({
  html: `<div class="bg-blue-600 p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
  className: 'custom-icon',
  iconSize: [30, 30],
});

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const [deliveryPhase, setDeliveryPhase] = useState<'idle' | 'to_pickup' | 'at_pickup' | 'to_dropoff' | 'completed'>('idle');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [foodCostInput, setFoodCostInput] = useState('');
  const [showFoodCostInput, setShowFoodCostInput] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const [isTracking, setIsTracking] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const [watchId, setWatchId] = useState<number | null>(null);

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Driver Dashboard View State
  const [dashboardView, setDashboardView] = useState<'orders' | 'schedule'>('orders');
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date>(new Date());
  const [scheduleBlocks, setScheduleBlocks] = useState<string[]>([]);
  const [scheduleIsLoading, setScheduleIsLoading] = useState(false);

  const TIME_SLOTS = [
    '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM',
    '10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM', '12:00 AM', '12:30 AM',
    '1:00 AM', '1:30 AM', '2:00 AM', '2:30 AM', '3:00 AM'
  ];

  // Fetch schedule blocks for the selected date
  useEffect(() => {
    if (!selectedScheduleDate) return;
    
    setScheduleIsLoading(true);
    const dateString = format(selectedScheduleDate, 'yyyy-MM-dd');
    const docRef = doc(db, 'schedule_blocks', dateString);
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists() && snap.data()?.blockedSlots) {
        setScheduleBlocks(snap.data().blockedSlots);
      } else {
        setScheduleBlocks([]);
      }
      setScheduleIsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedScheduleDate]);

  const toggleSlotBlock = async (slot: string) => {
    if (!selectedScheduleDate) return;
    const dateString = format(selectedScheduleDate, 'yyyy-MM-dd');
    const docRef = doc(db, 'schedule_blocks', dateString);
    
    let newBlocks = [...scheduleBlocks];
    if (newBlocks.includes(slot)) {
      newBlocks = newBlocks.filter(s => s !== slot);
    } else {
      newBlocks.push(slot);
    }
    
    // We optimistically update UI to feel snappy
    setScheduleBlocks(newBlocks);
    
    try {
      await setDoc(docRef, { blockedSlots: newBlocks }, { merge: true });
    } catch (err) {
      toast.error('Failed to update schedule block.');
      // Revert in case of failure could be handled here
    }
  };

  useEffect(() => {
    if (!activeDelivery) return;
    
    const fetchMessages = async () => {
      try {
        if (!activeDelivery?.id) return;
        const encodedId = encodeURIComponent(activeDelivery.id.trim());
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
  }, [activeDelivery]);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeDelivery) return;
    
    const text = newMessage;
    setNewMessage('');
    
    try {
      const encodedId = encodeURIComponent(activeDelivery.id.trim());
      await fetch(`/api/chat/${encodedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sender: 'driver', 
          text, 
          customerPhone: activeDelivery.customerPhone 
        })
      });
    } catch (err) {
      toast.error('Failed to send message');
    }
  };
  useEffect(() => {
    // Listen to Firestore orders
    const q = query(collection(db, 'orders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders: any[] = [];
      snapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });
      
      const formattedOrders = orders.map((o: any) => {
        let scheduledDate = new Date();
        
        if (o.date) {
          if (o.date.toDate) {
            scheduledDate = o.date.toDate();
          } else {
            const parsed = new Date(o.date);
            if (!isNaN(parsed.getTime())) {
              scheduledDate = parsed;
            }
          }
        } else if (o.createdAt) {
          const parsed = new Date(o.createdAt);
          if (!isNaN(parsed.getTime())) {
            scheduledDate = parsed;
          }
        }
        
        return {
          id: o.id || `ORD-${o.customerPhone?.slice(-4)}`,
          time: o.timeSlot ? o.timeSlot : (o.createdAt && !isNaN(new Date(o.createdAt).getTime()) ? new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just Now'),
          scheduledDate,
          pickup: o.pickupAddress,
          pickupCoords: o.pickupCoords,
          pickupNotes: o.pickupNotes,
          delivery: o.deliveryAddress,
          deliveryCoords: o.deliveryCoords,
          deliveryNotes: o.deliveryNotes,
          details: o.orderDetails || 'Standard delivery',
          receiptImage: o.receiptImage,
          status: o.status || 'pending',
          orderType: o.orderType || null,
          foodCost: o.foodCost || null,
          foodCostPaid: o.foodCostPaid || false,
          payout: '$' + ((o.deliveryFee || 0) * 0.8).toFixed(2),
          customerPhone: o.customerPhone,
          createdAt: o.createdAt || Date.now()
        };
      });
      
      // Sort by newest first
      formattedOrders.sort((a, b) => {
        const aTime = orders.find(o => o.id === a.id)?.createdAt || 0;
        const bTime = orders.find(o => o.id === b.id)?.createdAt || 0;
        return bTime - aTime;
      });
      
      setDeliveries(formattedOrders);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeDelivery) {
      const updatedDelivery = deliveries.find(d => d.id === activeDelivery.id);
      if (updatedDelivery) {
        if (updatedDelivery.status === 'cancelled_refunded') {
          toast.error('This order was cancelled by the customer.');
          setActiveDelivery(null);
          setDeliveryPhase('idle');
          stopTracking();
        } else if (JSON.stringify(updatedDelivery) !== JSON.stringify(activeDelivery)) {
          setActiveDelivery(updatedDelivery);
        }
      }
    }
  }, [deliveries, activeDelivery]);

  // Broadcast location and phase whenever they change
  useEffect(() => {
    if (location && isTracking) {
      localStorage.setItem('driver_location', JSON.stringify({
        lat: location.lat,
        lng: location.lng,
        phase: deliveryPhase,
        timestamp: Date.now()
      }));
    }
  }, [location, deliveryPhase, isTracking]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    toast.loading('Starting live tracking...');
    
    try {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          toast.dismiss();
          const { latitude, longitude } = position.coords;
          setLocation({ lat: latitude, lng: longitude });
          setIsTracking(true);
        },
        (error) => {
          toast.dismiss();
          toast.error(`Error getting location: ${error.message}`);
          setIsTracking(false);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
      setWatchId(id);
    } catch (err: any) {
      toast.dismiss();
      toast.error('Location services unavailable due to secure context restrictions.');
      setIsTracking(false);
    }
  };

  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  };

  const openExternalGPS = () => {
    if (!activeDelivery) return;
    const targetAddress = deliveryPhase === 'to_pickup' ? activeDelivery.pickup : activeDelivery.delivery;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(targetAddress)}`;
    window.open(url, '_blank');
    
    if (!isTracking) {
      startTracking();
    }
  };

  useEffect(() => {
    return () => stopTracking();
  }, []);

  const handleCancelAndRefund = async () => {
    if (!activeDelivery) return;
    
    toast.loading('Processing refund and cancellation...');
    try {
      const encodedId = encodeURIComponent(activeDelivery.id.trim());
      const res = await fetch(`/api/orders/${encodedId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isDriver: true })
      });
      const data = await res.json();
      
      toast.dismiss();
      if (data.success) {
        toast.success('Order cancelled and refunded successfully');
        setShowCancelConfirm(false);
        setActiveDelivery(null);
        setDeliveryPhase('idle');
      } else {
        toast.error(data.error || 'Failed to cancel order');
      }
    } catch (err) {
      toast.dismiss();
      toast.error('Failed to cancel order');
      console.error(err);
    }
  };

  const handleRequestPayment = async () => {
    if (!activeDelivery || !foodCostInput) return;
    
    const amount = parseFloat(foodCostInput);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (!receiptImage) {
      toast.error('Please attach a receipt image');
      return;
    }

    toast.loading('Requesting payment...');
    try {
      await updateDoc(doc(db, 'orders', activeDelivery.id), { 
        foodCost: amount,
        paymentRequested: true,
        foodCostPaid: false,
        receiptImage: receiptImage
      });
      
      // Trigger SMS via backend
      const encodedId = encodeURIComponent(activeDelivery.id.trim());
      await fetch(`/api/orders/status/${encodedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'payment_requested', 
          phone: activeDelivery.customerPhone,
          amount: amount
        })
      });

      toast.dismiss();
      toast.success('Payment requested successfully');
      setShowFoodCostInput(false);
      
      // Update local state to reflect the change
      setActiveDelivery({ ...activeDelivery, foodCost: amount, foodCostPaid: false, receiptImage: receiptImage });
    } catch (err) {
      toast.dismiss();
      toast.error('Failed to request payment');
      console.error(err);
    }
  };

  const updateStatus = async (newStatus: string, phase: any) => {
    setDeliveryPhase(phase);
    
    // Update Firestore
    try {
      await updateDoc(doc(db, 'orders', activeDelivery.id), { status: newStatus });
    } catch (err) {
      console.error('Failed to update Firestore status', err);
    }

    // Trigger SMS via backend
    try {
      const encodedId = encodeURIComponent(activeDelivery.id.trim());
      await fetch(`/api/orders/status/${encodedId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, phone: activeDelivery.customerPhone })
      });
    } catch (err) {
      console.error('Failed to send SMS', err);
    }
  };

  const handleSelectDelivery = (delivery: any) => {
    if (delivery.status === 'cancelled_refunded') {
      toast.error('This order was cancelled by the customer.');
      return;
    }
    setActiveDelivery(delivery);
    if (delivery.status === 'completed') {
      setDeliveryPhase('completed');
    } else if (delivery.status === 'at_pickup') {
      setDeliveryPhase('at_pickup');
    } else if (delivery.status === 'to_dropoff') {
      setDeliveryPhase('to_dropoff');
    } else if (delivery.status === 'at_dropoff') {
      setDeliveryPhase('at_dropoff');
    } else {
      setDeliveryPhase('idle');
    }
  };

  // Group deliveries by date for timeline
  const groupedDeliveries = deliveries.reduce((acc, delivery) => {
    let date = new Date(delivery.scheduledDate || delivery.createdAt || Date.now());
    if (isNaN(date.getTime())) {
      date = new Date();
    }
    const dateString = format(date, 'MMM d, yyyy');
    if (!acc[dateString]) acc[dateString] = [];
    acc[dateString].push(delivery);
    return acc;
  }, {} as Record<string, any[]>);

  // --- SCHEDULE VIEW ---
  if (!activeDelivery) {
    return (
      <div className="min-h-screen bg-brand-dark text-white p-6 pt-24 max-w-md mx-auto">
        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-brand-dark/80 backdrop-blur-md border-b border-white/5">
          <h1 
            onClick={() => navigate('/')}
            className="text-xl font-serif italic tracking-tight cursor-pointer select-none text-brand-gold"
          >
            FluidFlow
          </h1>
          <Badge variant="outline" className="border-brand-gold text-brand-gold">Driver Mode</Badge>
        </header>

        <div className="pb-6">
          <h1 className="text-3xl font-serif mb-2">Driver Portal</h1>
          <p className="text-white/50">Manage your deliveries and availability.</p>
        </div>

        <div className="flex bg-white/5 rounded-xl p-1 mb-8">
          <button 
            onClick={() => setDashboardView('orders')} 
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${dashboardView === 'orders' ? 'bg-brand-gold text-brand-dark shadow-md' : 'text-white/70 hover:bg-white/10'}`}
          >
            Order History
          </button>
          <button 
            onClick={() => setDashboardView('schedule')} 
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${dashboardView === 'schedule' ? 'bg-brand-gold text-brand-dark shadow-md' : 'text-white/70 hover:bg-white/10'}`}
          >
            Availability
          </button>
        </div>

        {dashboardView === 'schedule' ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <Card className="p-4 bg-white/5 border-white/10">
              <Calendar
                mode="single"
                selected={selectedScheduleDate}
                onSelect={(date) => date && setSelectedScheduleDate(date)}
                className="rounded-md border-none text-white mx-auto flex justify-center"
              />
            </Card>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-lg font-serif">Time Slots</h3>
                  <p className="text-xs text-brand-gold">{format(selectedScheduleDate, 'MMMM d, yyyy')}</p>
                </div>
                <p className="text-xs text-white/40">Tap to block/unblock</p>
              </div>

              {scheduleIsLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-20 bg-white/5 rounded-xl w-full"></div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const isBlocked = scheduleBlocks.includes(slot);
                    return (
                      <button
                        key={slot}
                        onClick={() => toggleSlotBlock(slot)}
                        className={`py-3 px-2 rounded-xl text-xs font-medium transition-all border ${
                          isBlocked
                            ? 'bg-red-500/20 border-red-500/30 text-red-400'
                            : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-white/10'
                        }`}
                      >
                        {slot}
                        <span className={`block text-[10px] mt-1 ${isBlocked ? 'text-red-400/70' : 'text-green-400/50'}`}>
                          {isBlocked ? 'BLOCKED' : 'AVAILABLE'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Waiting for new deliveries...</p>
            <p className="text-sm mt-2">Orders placed by customers will appear here.</p>
          </div>
        ) : (
          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
            {Object.entries(groupedDeliveries).map(([date, dateOrders], groupIdx) => (
              <div key={date} className="relative z-10">
                <div className="flex items-center mb-4 sticky top-20 z-20">
                  <div className="bg-brand-dark px-3 py-1 rounded-full border border-white/10 text-brand-gold text-sm font-bold shadow-lg flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    {date}
                  </div>
                </div>
                
                <div className="space-y-4">
                  {(dateOrders as any[]).map((delivery, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      key={delivery.id}
                      className="relative pl-8 md:pl-0"
                    >
                      <div className="md:hidden absolute left-0 top-6 w-10 h-0.5 bg-white/10"></div>
                      <div className="md:hidden absolute left-4 top-5 w-3 h-3 rounded-full bg-brand-dark border-2 border-brand-gold"></div>
                      
                      <Card 
                        onClick={() => handleSelectDelivery(delivery)}
                        className={`p-5 bg-white/5 border-white/10 cursor-pointer hover:bg-white/10 transition-all group ${delivery.status === 'completed' ? 'opacity-70' : 'border-brand-gold/30'}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-brand-gold">
                              <Package className="w-4 h-4" />
                              <span className="font-bold">{delivery.id}</span>
                            </div>
                            <p className="text-xs text-white/50">{delivery.time}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-white">{delivery.payout}</p>
                            <Badge variant="outline" className={
                              delivery.status === 'completed' ? 'border-red-500 text-red-500' :
                              delivery.status === 'cancelled_refunded' ? 'border-red-500 text-red-500' :
                              delivery.status === 'pending' ? 'border-brand-gold text-brand-gold' :
                              'border-blue-500 text-blue-500'
                            }>
                              {delivery.status === 'completed' ? 'ORDER COMPLETED' : 
                               delivery.status === 'cancelled_refunded' ? 'CANCELLED & REFUNDED' : 
                               delivery.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-3 text-sm text-white/70">
                          <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 mt-0.5 text-white/40 shrink-0" />
                            <span className="line-clamp-1">{delivery.pickup}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 mt-0.5 text-brand-gold shrink-0" />
                            <span className="line-clamp-1">{delivery.delivery}</span>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- ACTIVE DELIVERY VIEW ---
  return (
    <div className="min-h-screen bg-brand-dark text-white p-6 pt-24 max-w-md mx-auto flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between bg-brand-dark/80 backdrop-blur-md border-b border-white/5">
        <h1 
          onClick={() => navigate('/')}
          className="text-xl font-serif italic tracking-tight cursor-pointer select-none text-brand-gold"
        >
          FluidFlow
        </h1>
        <Badge variant="outline" className="border-brand-gold text-brand-gold">Driver Mode</Badge>
      </header>

      <button 
        onClick={() => {
          stopTracking();
          setActiveDelivery(null);
          setDeliveryPhase('idle');
          setShowCancelConfirm(false);
        }} 
        className="flex items-center gap-2 text-brand-gold mb-6 pt-4 hover:opacity-80 transition-opacity w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Schedule
      </button>

      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-serif">Delivery {activeDelivery.id}</h2>
          <p className="text-white/50 text-sm mt-1">
            {deliveryPhase === 'idle' && 'Ready to start'}
            {deliveryPhase === 'to_pickup' && 'Heading to pickup...'}
            {deliveryPhase === 'at_pickup' && 'At pickup location'}
            {deliveryPhase === 'to_dropoff' && 'Heading to dropoff...'}
            {deliveryPhase === 'completed' && 'Delivery completed'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Payout</p>
          <p className="text-lg font-medium text-green-400">{activeDelivery.payout}</p>
        </div>
      </div>

      {/* Communication Buttons */}
      {activeDelivery.customerPhone && (
        <div className="flex gap-3 mb-6">
          <Button 
            onClick={() => setIsChatOpen(true)}
            className="flex-1 h-12 rounded-xl bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 border border-brand-gold/20"
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Message
          </Button>
          <a 
            href={`tel:${activeDelivery.customerPhone}`}
            target="_top"
            className="flex-1 h-12 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 flex items-center justify-center font-medium transition-colors"
          >
            <Phone className="w-4 h-4 mr-2" /> Call
          </a>
        </div>
      )}

      {/* Tracking Status Indicator */}
      {isTracking && (
        <div className="mb-6 p-4 bg-brand-gold/10 border border-brand-gold/30 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-brand-gold animate-pulse" />
            <div>
              <p className="text-sm font-bold text-brand-gold">Live Tracking Active</p>
              <p className="text-xs text-brand-gold/70">Customer can see your location</p>
            </div>
          </div>
          <Button onClick={stopTracking} variant="ghost" className="text-brand-gold hover:bg-brand-gold/20 h-8 px-3 text-xs">
            Stop
          </Button>
        </div>
      )}

      {/* Map View */}
      {location && activeDelivery && (
        <div className="mb-6 h-64 rounded-2xl overflow-hidden border border-white/10">
          <MapContainer 
            center={[location.lat, location.lng]} 
            zoom={13} 
            className="h-full w-full"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[activeDelivery.pickupCoords.lat, activeDelivery.pickupCoords.lon]} icon={RestaurantIcon} />
            <Marker position={[activeDelivery.deliveryCoords.lat, activeDelivery.deliveryCoords.lon]} icon={HouseIcon} />
            <Marker position={[location.lat, location.lng]} />
            <Polyline 
              positions={[
                [activeDelivery.pickupCoords.lat, activeDelivery.pickupCoords.lon],
                [location.lat, location.lng],
                [activeDelivery.deliveryCoords.lat, activeDelivery.deliveryCoords.lon]
              ]} 
              color="blue" 
            />
          </MapContainer>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-4 flex-1">
        {deliveryPhase === 'idle' && (
          <Button 
            onClick={() => {
              updateStatus('to_pickup', 'to_pickup');
              startTracking();
            }} 
            className="w-full h-14 rounded-2xl bg-brand-gold text-brand-dark hover:bg-brand-gold/90 text-lg font-medium"
          >
            Accept & Start Delivery
          </Button>
        )}

        {(deliveryPhase === 'to_pickup' || deliveryPhase === 'to_dropoff') && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Button onClick={openExternalGPS} className="w-full h-16 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 text-lg font-medium shadow-lg shadow-blue-900/20">
              <ExternalLink className="w-5 h-5 mr-2" /> 
              Navigate to {deliveryPhase === 'to_pickup' ? 'Pickup' : 'Dropoff'}
            </Button>

            {deliveryPhase === 'to_pickup' ? (
              <Button 
                onClick={() => updateStatus('at_pickup', 'at_pickup')} 
                className="w-full h-14 rounded-2xl bg-brand-gold text-brand-dark hover:bg-brand-gold/90 text-lg font-medium mt-4"
              >
                Arrived at Pickup
              </Button>
            ) : (
              <div className="space-y-3 mt-4">
                <Button 
                  onClick={() => updateStatus('at_dropoff', 'at_dropoff')} 
                  className="w-full h-14 rounded-2xl bg-brand-gold text-brand-dark hover:bg-brand-gold/90 text-lg font-medium"
                >
                  Arrived at Customer
                </Button>
                <Button 
                  onClick={() => updateStatus('at_pickup', 'at_pickup')} 
                  variant="outline"
                  className="w-full h-12 rounded-2xl border-white/20 text-white hover:bg-white/10"
                >
                  Go Back to Previous Step
                </Button>
              </div>
            )}
          </div>
        )}

        {deliveryPhase === 'at_dropoff' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Button 
              onClick={() => { 
                stopTracking(); 
                updateStatus('completed', 'completed');
              }} 
              className="w-full h-14 rounded-2xl bg-green-500 text-white hover:bg-green-600 text-lg font-medium"
            >
              Complete Delivery
            </Button>
            <Button 
              onClick={() => updateStatus('to_dropoff', 'to_dropoff')} 
              variant="outline"
              className="w-full h-12 rounded-2xl border-white/20 text-white hover:bg-white/10"
            >
              Go Back to Previous Step
            </Button>
          </div>
        )}

        {deliveryPhase === 'at_pickup' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeDelivery.orderType === 'order_for_me' && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                <h3 className="font-bold text-brand-gold flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Request Food Payment
                </h3>
                <p className="text-sm text-white/70">Enter the total cost of the food to request payment from the customer.</p>
                
                {activeDelivery.foodCost ? (
                  <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400">
                    <p className="text-sm font-medium">Payment requested: ${activeDelivery.foodCost.toFixed(2)}</p>
                    <p className="text-xs mt-1">{activeDelivery.foodCostPaid ? 'Customer has paid.' : 'Waiting for customer to pay...'}</p>
                    {activeDelivery.receiptImage && (
                      <img 
                        src={activeDelivery.receiptImage} 
                        alt="Receipt" 
                        className="mt-2 rounded-lg max-h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                        onClick={() => setSelectedImage(activeDelivery.receiptImage)}
                      />
                    )}
                  </div>
                ) : showFoodCostInput ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00"
                        value={foodCostInput}
                        onChange={(e) => setFoodCostInput(e.target.value)}
                        className="pl-9 bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs text-white/50 uppercase tracking-wider">Attach Receipt Image</label>
                      <Input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              // Basic resize to prevent large base64 strings
                              const img = new Image();
                              img.onload = () => {
                                const canvas = document.createElement('canvas');
                                const MAX_WIDTH = 800;
                                const MAX_HEIGHT = 800;
                                let width = img.width;
                                let height = img.height;

                                if (width > height) {
                                  if (width > MAX_WIDTH) {
                                    height *= MAX_WIDTH / width;
                                    width = MAX_WIDTH;
                                  }
                                } else {
                                  if (height > MAX_HEIGHT) {
                                    width *= MAX_HEIGHT / height;
                                    height = MAX_HEIGHT;
                                  }
                                }
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx?.drawImage(img, 0, 0, width, height);
                                setReceiptImage(canvas.toDataURL('image/jpeg', 0.7));
                              };
                              img.src = reader.result as string;
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="bg-white/5 border-white/10 text-white file:text-brand-gold file:bg-transparent file:border-0 file:mr-4 file:font-medium"
                      />
                      {receiptImage && (
                        <div className="mt-2 relative inline-block">
                          <img src={receiptImage} alt="Receipt preview" className="h-20 rounded-md border border-white/20" />
                          <button 
                            onClick={() => setReceiptImage(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={handleRequestPayment}
                        className="flex-1 bg-brand-gold text-brand-dark hover:bg-brand-gold/90"
                      >
                        Send Request
                      </Button>
                      <Button 
                        onClick={() => setShowFoodCostInput(false)}
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={() => setShowFoodCostInput(true)}
                    className="w-full bg-white/10 text-white hover:bg-white/20"
                  >
                    Request Order Payment
                  </Button>
                )}
              </div>
            )}

            <Button 
              onClick={() => updateStatus('to_dropoff', 'to_dropoff')} 
              className="w-full h-14 rounded-2xl bg-brand-gold text-brand-dark hover:bg-brand-gold/90 text-lg font-medium"
            >
              Confirm Pickup & Head to Dropoff
            </Button>
            
            <Button 
              onClick={() => updateStatus('to_pickup', 'to_pickup')} 
              variant="outline"
              className="w-full h-12 rounded-2xl border-white/20 text-white hover:bg-white/10"
            >
              Go Back to Previous Step
            </Button>
          </div>
        )}

        {deliveryPhase === 'completed' && (
          <div className="text-center space-y-6 py-8 animate-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-red-500" />
            </div>
            <div>
              <h3 className="text-2xl font-serif mb-2 text-red-500">Order Completed!</h3>
              <p className="text-white/50">Great job. You earned {activeDelivery.payout}.</p>
            </div>
            <Button 
              onClick={() => {
                setDeliveries(deliveries.filter(d => d.id !== activeDelivery.id));
                setActiveDelivery(null);
                setDeliveryPhase('idle');
              }} 
              className="w-full h-14 rounded-2xl bg-white/10 text-white hover:bg-white/20 text-lg font-medium"
            >
              Return to Schedule
            </Button>
          </div>
        )}

        {/* Persistent Order Info during active delivery */}
        {deliveryPhase !== 'idle' && (
          <Card className="p-5 bg-white/5 border-white/10 mt-8 space-y-5 animate-in fade-in duration-500">
            <div>
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">Order Details</h3>
              <p className="text-sm text-white/90 leading-relaxed">{activeDelivery.details}</p>
            </div>

            {activeDelivery.receiptImage && (
              <div>
                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2">Attached Image</h3>
                <img 
                  src={activeDelivery.receiptImage} 
                  alt="Attachment" 
                  className="w-full h-32 object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-80 transition-opacity" 
                  onClick={() => setSelectedImage(activeDelivery.receiptImage)}
                />
              </div>
            )}

            {activeDelivery.pickupNotes && (
              <div className="bg-brand-gold/10 border border-brand-gold/20 p-3 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-brand-gold mb-1">Pickup Notes</p>
                <p className="text-xs text-brand-gold/90 leading-relaxed">{activeDelivery.pickupNotes}</p>
              </div>
            )}

            {activeDelivery.deliveryNotes && (
              <div className="bg-brand-gold/10 border border-brand-gold/20 p-3 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-brand-gold mb-1">Delivery Notes</p>
                <p className="text-xs text-brand-gold/90 leading-relaxed">{activeDelivery.deliveryNotes}</p>
              </div>
            )}
            
            {/* Cancel & Refund Button */}
            <div className="pt-4 border-t border-white/10">
              {showCancelConfirm ? (
                <div className="space-y-3 animate-in fade-in">
                  <p className="text-sm text-red-400 font-medium">Are you sure you want to cancel and refund this order? This action cannot be undone.</p>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleCancelAndRefund}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      Confirm Refund
                    </Button>
                    <Button 
                      onClick={() => setShowCancelConfirm(false)}
                      variant="outline"
                      className="flex-1 border-white/20 text-white hover:bg-white/10"
                    >
                      Keep Order
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  onClick={() => setShowCancelConfirm(true)}
                  variant="outline"
                  className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Cancel & Refund Order
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Chat Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-brand-dark border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[500px] max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-gold" />
                Chat with Customer
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
                  <div key={msg.id} className={`flex ${msg.sender === 'driver' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      msg.sender === 'driver' 
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

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedImage(null)} 
              className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors bg-black/50 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={selectedImage} 
              alt="Full size attachment" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

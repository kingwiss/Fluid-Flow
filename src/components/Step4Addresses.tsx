import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { OrderState, Coupon, Coordinates } from '../types';
import { MapPin, Navigation, Search, Star, History, Tag, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface Props {
  order: OrderState;
  updateOrder: (updates: Partial<OrderState>) => void;
  onNext: () => void;
  onViewHistory?: () => void;
}

const formatAddress = (feature: any) => {
  // Mapbox format
  if (feature.place_name) {
    return feature.place_name.replace(', United States', '');
  }
  
  // Photon format
  const properties = feature.properties || {};
  const parts = [];
  if (properties.name) parts.push(properties.name);
  
  const addressPart = [];
  if (properties.housenumber) addressPart.push(properties.housenumber);
  if (properties.street) addressPart.push(properties.street);
  
  const addressStr = addressPart.join(' ');
  if (addressStr && addressStr !== properties.name) {
    parts.push(addressStr);
  }
  
  if (properties.city) parts.push(properties.city);
  if (properties.state) parts.push(properties.state);
  
  return parts.join(', ');
};

export default function Step4Addresses({ order, updateOrder, onNext, onViewHistory }: Props) {
  const [activeField, setActiveField] = useState<'pickup' | 'delivery' | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [isFetchingCoupons, setIsFetchingCoupons] = useState(false);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);
  const [orderHistory, setOrderHistory] = useState<{name: string, address: string, coords: Coordinates}[]>([]);

  useEffect(() => {
    if (order.customerPhone) {
      const fetchHistory = async () => {
        try {
          const q = query(collection(db, 'orders'), where('customerPhone', '==', order.customerPhone), orderBy('createdAt', 'desc'), limit(15));
          const snapshot = await getDocs(q);
          
          const locs: {name: string, address: string, coords: Coordinates}[] = [];
          const seen = new Set<string>();

          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.pickupAddress && !seen.has(data.pickupAddress)) {
              locs.push({ name: 'Pickup History', address: data.pickupAddress, coords: data.pickupCoords });
              seen.add(data.pickupAddress);
            }
            if (data.deliveryAddress && !seen.has(data.deliveryAddress)) {
              locs.push({ name: 'Delivery History', address: data.deliveryAddress, coords: data.deliveryCoords });
              seen.add(data.deliveryAddress);
            }
          });
          setOrderHistory(locs);
        } catch(e) {}
      };
      fetchHistory();
    }
  }, [order.customerPhone]);

  const RECENT_LOCATIONS = orderHistory.slice(0, 4);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    toast.loading('Finding your location...');
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          toast.dismiss();
          
          try {
            // Reverse geocode to get a readable address
            const res = await fetch(`https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}`);
            const data = await res.json();
            let addressName = 'Current Location';
            if (data.features && data.features.length > 0) {
              addressName = formatAddress(data.features[0]);
            }
            
            updateOrder({ 
              deliveryAddress: addressName, 
              deliveryCoords: { lat: latitude, lon: longitude } 
            });
            toast.success('Location found!');
          } catch (error) {
            // Fallback if reverse geocode fails
            updateOrder({ 
              deliveryAddress: 'Current Location', 
              deliveryCoords: { lat: latitude, lon: longitude } 
            });
            toast.success('Location found!');
          }
        },
        (error) => {
          toast.dismiss();
          toast.error('Unable to retrieve your location. Please check your browser permissions.');
        }
      );
    } catch (err: any) {
      toast.dismiss();
      toast.error('Location services unavailable due to secure context restrictions.');
    }
  };

  // Geocoding using OpenStreetMap (Photon) via backend
  const searchAddress = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      // Biased to Philadelphia: lat=39.9526, lon=-75.1652
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=39.9526&lon=-75.1652&limit=15`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.error) {
        toast.error(data.error, { id: 'maps-error' });
        setSearchResults([{ error: true, message: data.error }]);
        return;
      }
      
      // Photon returns a GeoJSON FeatureCollection
      if (data.features) {
        if (data.features.length === 0) {
          setSearchResults([{ error: true, message: 'No results found' }]);
        } else {
          setSearchResults(data.features);
        }
      } else {
        setSearchResults([{ error: true, message: 'Invalid response from maps API' }]);
      }
    } catch (error: any) {
      console.error('Geocoding error:', error);
      setSearchResults([{ error: true, message: error.message || 'Network error' }]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!activeField) return;
    const query = activeField === 'pickup' ? order.pickupAddress : order.deliveryAddress;
    const timeoutId = setTimeout(() => searchAddress(query), 300); // Fast debounce for Photon
    return () => clearTimeout(timeoutId);
  }, [order.pickupAddress, order.deliveryAddress, activeField]);

  // Fetch distance and calculate fee when both coordinates are set
  useEffect(() => {
    if (order.pickupCoords && order.deliveryCoords) {
      setIsCalculatingFee(true);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout on frontend

      fetch('/api/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup: order.pickupCoords, dropoff: order.deliveryCoords }),
        signal: controller.signal
      })
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        if (data.fee) {
          updateOrder({ deliveryFee: data.fee });
          toast.success(`Delivery fee calculated: $${data.fee.toFixed(2)}`);
        }
      })
      .catch(err => {
        console.error('Distance calculation failed:', err);
        toast.error('Using estimated delivery fee due to network delay');
        // Fallback fee of $5.00 if everything fails
        updateOrder({ deliveryFee: 5.00 });
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setIsCalculatingFee(false);
      });
    }
  }, [order.pickupCoords, order.deliveryCoords]);

  // Fetch coupons when pickup address is set
  useEffect(() => {
    if (order.pickupAddress && order.pickupCoords) {
      setIsFetchingCoupons(true);
      setAvailableCoupons([]); // Clear previous coupons
      
      fetch(`/api/coupons?restaurant=${encodeURIComponent(order.pickupAddress)}`)
        .then(res => res.json())
        .then(data => {
          if (data.coupons && data.coupons.length > 0) {
            setAvailableCoupons(data.coupons);
            toast.info(`Found ${data.coupons.length} offers for this location!`);
          }
        })
        .catch(err => console.error('Coupon fetch failed:', err))
        .finally(() => setIsFetchingCoupons(false));
    }
  }, [order.pickupCoords, order.pickupAddress]);

  const handleSelectResult = async (result: any, field: 'pickup' | 'delivery') => {
    const description = formatAddress(result);
    // Both Mapbox and Photon return GeoJSON: coordinates are [lon, lat]
    const coords = { 
      lat: result.geometry.coordinates[1], 
      lon: result.geometry.coordinates[0] 
    };

    if (field === 'pickup') {
      updateOrder({ pickupAddress: description, pickupCoords: coords });
    } else {
      updateOrder({ deliveryAddress: description, deliveryCoords: coords });
    }
    setSearchResults([]);
    setActiveField(null);
  };

  console.log('Render Step4Addresses:', { activeField, searchResultsCount: searchResults.length, pickupAddress: order.pickupAddress });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-serif">Route Details</h2>
        <p className="text-white/50">Where are we picking up and delivering to?</p>
      </div>

      <div className="space-y-4 relative">
        <div className="absolute left-7 top-14 bottom-14 w-0.5 bg-gradient-to-b from-brand-gold to-white/10 z-0" />

        <div className="space-y-2 relative z-[100]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-brand-gold shadow-[0_0_10px_rgba(212,175,55,0.5)] ml-[21px]" />
            <span className="text-[10px] uppercase tracking-widest text-brand-gold font-bold">Pickup From</span>
          </div>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-brand-gold transition-colors" />
            <Input
              value={order.pickupAddress}
              onChange={(e) => {
                updateOrder({ pickupAddress: e.target.value, pickupCoords: null });
                setActiveField('pickup');
              }}
              onFocus={() => setActiveField('pickup')}
              placeholder="Restaurant or Store name..."
              className="h-14 pl-12 pr-4 rounded-2xl bg-white/5 border-white/10 focus:border-brand-gold/50 focus:ring-brand-gold/20 transition-all"
            />
            {/* Pickup Search Results Dropdown */}
            {searchResults.length > 0 && activeField === 'pickup' && (
              <div className="absolute top-full left-0 z-[100] w-full mt-2 p-2 bg-black border border-white/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] max-h-60 overflow-y-auto flex flex-col gap-1">
                {searchResults.map((result, idx) => (
                  result.error ? (
                    <div key={idx} className="w-full text-left p-3 text-sm text-white/50 leading-relaxed">
                      {result.message}
                    </div>
                  ) : (
                    <button
                      key={idx}
                      onClick={() => handleSelectResult(result, 'pickup')}
                      className="w-full text-left p-3 hover:bg-white/10 rounded-xl transition-colors text-sm text-white leading-relaxed"
                    >
                      {formatAddress(result)}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
          <div className="pt-2">
            <Input
              value={order.pickupNotes || ''}
              onChange={(e) => updateOrder({ pickupNotes: e.target.value })}
              placeholder="Add pickup notes (e.g., Suite 100, Ask for John)..."
              className="h-12 rounded-xl bg-white/5 border-white/10 text-sm focus:border-brand-gold/50 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2 relative z-[90]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <Navigation className="w-4 h-4 text-white/40 ml-[18px]" />
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Deliver To</span>
            </div>
            <button 
              onClick={handleGetCurrentLocation}
              className="text-[10px] uppercase tracking-widest font-bold text-brand-gold hover:text-white transition-colors mr-2 flex items-center gap-1"
            >
              <MapPin className="w-3 h-3" />
              Use Current Location
            </button>
          </div>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-brand-gold transition-colors" />
            <Input
              value={order.deliveryAddress}
              onChange={(e) => {
                updateOrder({ deliveryAddress: e.target.value, deliveryCoords: null });
                setActiveField('delivery');
              }}
              onFocus={() => setActiveField('delivery')}
              placeholder="Your delivery address..."
              className="h-14 pl-12 pr-4 rounded-2xl bg-white/5 border-white/10 focus:border-brand-gold/50 focus:ring-brand-gold/20 transition-all"
            />
            {/* Delivery Search Results Dropdown */}
            {searchResults.length > 0 && activeField === 'delivery' && (
              <div className="absolute top-full left-0 z-[100] w-full mt-2 p-2 bg-black border border-white/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] max-h-60 overflow-y-auto flex flex-col gap-1">
                {searchResults.map((result, idx) => (
                  result.error ? (
                    <div key={idx} className="w-full text-left p-3 text-sm text-white/50 leading-relaxed">
                      {result.message}
                    </div>
                  ) : (
                    <button
                      key={idx}
                      onClick={() => handleSelectResult(result, 'delivery')}
                      className="w-full text-left p-3 hover:bg-white/10 rounded-xl transition-colors text-sm text-white leading-relaxed"
                    >
                      {formatAddress(result)}
                    </button>
                  )
                ))}
              </div>
            )}
          </div>
          <div className="pt-2">
            <Input
              value={order.deliveryNotes || ''}
              onChange={(e) => updateOrder({ deliveryNotes: e.target.value })}
              placeholder="Add delivery notes (e.g., Apt 4B, Gate code 1234)..."
              className="h-12 rounded-xl bg-white/5 border-white/10 text-sm focus:border-brand-gold/50 transition-all"
            />
          </div>
        </div>

      </div>

      {/* Auto-Detected Coupons Section */}
      {(availableCoupons.length > 0 || isFetchingCoupons) && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-brand-gold flex items-center gap-2">
            <Tag className="w-4 h-4" /> 
            {isFetchingCoupons ? 'Scanning for offers...' : 'Auto-Detected Offers'}
          </h4>
          
          {isFetchingCoupons ? (
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center h-24">
              <div className="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid gap-2 mb-4">
              {availableCoupons.map((coupon) => (
                <button
                  key={coupon.id}
                  onClick={() => updateOrder({ appliedCoupon: order.appliedCoupon?.id === coupon.id ? undefined : coupon })}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    order.appliedCoupon?.id === coupon.id
                      ? 'bg-brand-gold/20 border-brand-gold text-brand-gold'
                      : 'bg-white/5 border-white/10 hover:border-brand-gold/50 text-white/70'
                  }`}
                >
                  <div className="text-left">
                    <p className="font-bold text-sm">{coupon.code}</p>
                    <p className="text-xs opacity-80">{coupon.description}</p>
                  </div>
                  {order.appliedCoupon?.id === coupon.id && <CheckCircle2 className="w-5 h-5 fill-current" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {onViewHistory ? (
            <button 
              onClick={onViewHistory}
              className="text-xs font-bold uppercase tracking-widest text-brand-gold hover:text-brand-gold/80 hover:underline flex items-center gap-1 transition-all"
            >
              Recent & Saved
            </button>
          ) : (
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/30">Recent & Saved</h4>
          )}
        </div>
        
        <div className="grid gap-2">
          {RECENT_LOCATIONS.map((loc, i) => (
            <button
              key={i}
              onClick={() => {
                if (activeField === 'pickup') updateOrder({ pickupAddress: loc.address, pickupCoords: loc.coords });
                else updateOrder({ deliveryAddress: loc.address, deliveryCoords: loc.coords });
                setActiveField(null);
              }}
              className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left group"
            >
              <div className="p-2 rounded-xl bg-white/5 text-white/40 group-hover:text-brand-gold transition-colors">
                {loc.name === 'Home' ? <Star className="w-4 h-4" /> : <History className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-sm font-medium">{loc.name}</p>
                <p className="text-xs text-white/40 truncate max-w-[200px]">{loc.address}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Button
        disabled={!order.pickupAddress || !order.deliveryAddress || isCalculatingFee}
        onClick={onNext}
        className="w-full h-14 rounded-2xl bg-white text-brand-dark hover:bg-brand-gold transition-all text-lg font-medium"
      >
        {isCalculatingFee ? 'Calculating Route...' : 'Review Order'}
      </Button>
    </div>
  );
}

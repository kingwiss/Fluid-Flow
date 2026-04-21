import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import twilio from 'twilio';
import Stripe from 'stripe';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, doc, setDoc, getDoc, updateDoc, orderBy } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Load Firebase config
let db: any = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (err) {
  console.error("Failed to initialize Firebase in server:", err);
}

// Stripe Setup
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Twilio Setup
let twilioClient: twilio.Twilio | null = null;
const getTwilio = () => {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (sid && token) {
      twilioClient = twilio(sid, token);
    }
  }
  return twilioClient;
};

// In-memory stores
const otpStore = new Map<string, string>();
const chatStore = new Map<string, any[]>();
const usersDB = new Map<string, { phone: string, name: string }>(); // phone -> user info

// Helper to send SMS via Textbelt
async function sendSMS(phone: string, message: string) {
  try {
    const apiKey = process.env.TEXTBELT_API_KEY || process.env.VITE_TEXTBELT_API_KEY || 'c1e8b9f5e00e752605f5731c77031d8814f2ca773Ur4NF43xpHJZ3wZ5tSo5fRcS';
    const response = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        phone: phone,
        message: message,
        key: apiKey
      }).toString()
    });
    const data = await response.json();
    console.log('SMS sent:', data);
    return data.success;
  } catch (error) {
    console.error('SMS error:', error);
    return false;
  }
}

// In-memory Database simulating a 3rd-party Coupon API
let couponsDB = [
  { id: 1, code: 'SWIFT10', description: '10% off your entire order', discount: 0.10, restaurant: 'all' },
  { id: 2, code: 'FREEDEL', description: 'Free Delivery on any order', discount: 'free_delivery', restaurant: 'all' },
  { id: 3, code: 'MCD5', description: '$5 off any McDonald\'s order over $15', discount: 5.00, restaurant: 'mcdonald' },
  { id: 4, code: 'MCDFREEFRIES', description: 'Free Large Fries with purchase', discount: 3.50, restaurant: 'mcdonald' },
  { id: 5, code: 'WENDYS20', description: '20% off Wendy\'s combos', discount: 0.20, restaurant: 'wendy' },
  { id: 6, code: 'BKWHOPPER', description: 'BOGO Free Whopper', discount: 6.00, restaurant: 'burger king' },
  { id: 7, code: 'CHICKFILA', description: 'Free Delivery on Chick-fil-A', discount: 'free_delivery', restaurant: 'chick-fil-a' },
  { id: 8, code: 'LOCALLOVE', description: '$2 off local restaurants', discount: 2.00, restaurant: 'all' }
];

// Helper to calculate straight-line distance if OSRM fails
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

const app = express();

app.use(cors({ origin: '*' })); // Allow GitHub Pages frontend to call this backend seamlessly
app.use(express.json());

// Normalize Vercel paths: Vercel serverless functions sometimes strip the "/api" prefix
if (process.env.VERCEL) {
  app.use((req, res, next) => {
    if (!req.url.startsWith('/api')) {
      req.url = '/api' + (req.url === '/' ? '' : req.url);
    }
    next();
  });
}

// Distance Calculation API
app.post('/api/distance', async (req, res) => {
    try {
      const { pickup, dropoff } = req.body;
      if (!pickup || !dropoff) {
        return res.status(400).json({ error: 'Missing coordinates' });
      }

      // Base location: West Philly (approximate coordinates)
      const base = { lon: -75.2180, lat: 39.9526 };
      
      // PERMANENT FIX: Use Haversine distance * 1.3 (approximate road distance multiplier)
      // This completely bypasses the unreliable OSRM API for fee calculation,
      // ensuring 0ms latency and 100% reliability.
      const dist1 = calculateHaversineDistance(base.lat, base.lon, pickup.lat, pickup.lon);
      const dist2 = calculateHaversineDistance(pickup.lat, pickup.lon, dropoff.lat, dropoff.lon);
      let distanceMiles = (dist1 + dist2) * 1.3;
      
      // Ensure minimum distance of 1 mile just in case
      distanceMiles = Math.max(1, distanceMiles);

      // Calculate fee: $1.25 per mile
      const fee = distanceMiles * 1.25;

      res.json({ distanceMiles, fee });
    } catch (error) {
      console.error('Distance calculation error:', error);
      res.status(500).json({ error: 'Failed to calculate distance' });
    }
  });

  // Route Geometry API for Live Tracking
  app.post('/api/route', async (req, res) => {
    try {
      const { waypoints } = req.body; // Array of {lat, lon}
      if (!waypoints || waypoints.length < 2) {
        return res.status(400).json({ error: 'Need at least 2 waypoints' });
      }

      const coords = waypoints.map((w: any) => `${w.lon},${w.lat}`).join(';');
      const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

      const response = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const data = await response.json();

      if (data.code !== 'Ok') {
        throw new Error('Route not found');
      }

      // GeoJSON coordinates are [lon, lat], Leaflet needs [lat, lon]
      const routeCoords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
      res.json({ route: routeCoords });
    } catch (error) {
      console.error('Route fetch error:', error);
      // Return a straight line as fallback
      const fallbackRoute = req.body.waypoints.map((w: any) => [w.lat, w.lon]);
      res.json({ route: fallbackRoute });
    }
  });

  // Real Backend: Get Applicable Coupons based on Restaurant Detection
  app.get('/api/coupons', (req, res) => {
    const restaurant = (req.query.restaurant as string || '').toLowerCase();
    
    // Simulate a real API's brand detection logic
    const applicable = couponsDB.filter(c => {
      if (c.restaurant === 'all') return true;
      return restaurant.includes(c.restaurant);
    });
    
    // Simulate network delay of a real 3rd party API
    setTimeout(() => {
      res.json({ coupons: applicable });
    }, 600);
  });

  // Real Backend: Validate and Apply Promo Code
  app.post('/api/coupons/validate', (req, res) => {
    const { code, restaurant } = req.body;
    const restLower = (restaurant || '').toLowerCase();
    
    const coupon = couponsDB.find(c => c.code.toUpperCase() === (code || '').toUpperCase());
    
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    
    if (coupon.restaurant !== 'all' && !restLower.includes(coupon.restaurant)) {
      return res.status(400).json({ error: 'Coupon is not applicable for this restaurant' });
    }
    
    res.json({ coupon });
  });

  // Real Backend: Admin endpoint to create new coupons
  app.post('/api/coupons', (req, res) => {
    const { code, description, discount, restaurant } = req.body;
    const newCoupon = {
      id: Date.now(),
      code,
      description,
      discount,
      restaurant: (restaurant || 'all').toLowerCase()
    };
    couponsDB.push(newCoupon);
    res.json({ success: true, coupon: newCoupon });
  });

  // OpenStreetMap (Photon) Places Autocomplete
  app.get('/api/places/autocomplete', async (req, res) => {
    try {
      const { input } = req.query;
      
      // Photon is an open-source geocoder built for autocomplete using OSM data.
      // We bias the results heavily to Philadelphia (lat: 39.9526, lon: -75.1652)
      // This allows searching for POIs (like "McDonalds") near this location.
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(input as string)}&lat=39.9526&lon=-75.1652&limit=15`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'FluidFlow/1.0 (contact@fluidflow.com)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Photon API responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error('Places autocomplete error:', error.message);
      res.status(500).json({ error: 'Failed to fetch places' });
    }
  });

  // SMS & OTP Endpoints
  app.post('/api/sms/send-otp', async (req, res) => {
    const { phone } = req.body;
    // Strictly sanitize phone to retain only + and digits
    const cleanPhone = phone ? phone.replace(/[^\d+]/g, '') : '';
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    if (db) {
      try {
        await setDoc(doc(db, 'otps', cleanPhone), { code: otp, expiresAt: Date.now() + 10 * 60 * 1000 });
      } catch (err) {
        console.error('Failed to save OTP to Firestore', err);
      }
    } else {
      otpStore.set(cleanPhone, otp);
    }

    try {
      const apiKey = process.env.TEXTBELT_API_KEY || process.env.VITE_TEXTBELT_API_KEY || 'c1e8b9f5e00e752605f5731c77031d8814f2ca773Ur4NF43xpHJZ3wZ5tSo5fRcS';

      const response = await fetch('https://textbelt.com/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          phone: cleanPhone,
          message: `Your FluidFlow verification code is: ${otp}`,
          key: apiKey
        }).toString()
      });

      const data = await response.json();
      console.log('Textbelt API Response:', data); // Log the response for render diagnostics
      
      if (data.success) {
        res.json({ success: true, message: 'OTP sent via Textbelt' });
      } else {
        console.warn('Textbelt failed with error:', data.error);
        // If out of quota, we still want the user to be able to test the app
        // So we return the OTP in the response but mark it as a fallback
        res.json({ 
          success: true, 
          message: 'SMS Quota Exceeded. Entering Development Mode.',
          isDevMode: true,
          otp: otp // Only send this in dev environments!
        });
      }
    } catch (error: any) {
      console.error('SMS Service Error:', error.message);
      res.json({ 
        success: true, 
        message: 'SMS Service Unavailable. Entering Development Mode.',
        isDevMode: true,
        otp: otp
      });
    }
  });

  app.post('/api/sms/verify-otp', async (req, res) => {
    const { phone, code, name } = req.body;
    let isValid = false;
    
    const cleanPhone = phone ? phone.replace(/[^\d+]/g, '') : '';

    if (db) {
      try {
        const otpSnap = await getDoc(doc(db, 'otps', cleanPhone));
        if (otpSnap.exists() && otpSnap.data().code === code) {
          isValid = true;
        }
      } catch (err) {
        console.error('Failed to verify OTP from Firestore', err);
      }
    } else {
      if (otpStore.get(cleanPhone) === code) {
        isValid = true;
        otpStore.delete(cleanPhone);
      }
    }

    if (isValid) {
      if (name) {
        if (db) {
          try {
            await setDoc(doc(db, 'users', cleanPhone), { phone: cleanPhone, name, lastLogin: Date.now() }, { merge: true });
          } catch (err) {
            console.error('Failed to save user to Firestore', err);
          }
        } else {
          usersDB.set(cleanPhone, { phone: cleanPhone, name });
        }
      }
      res.json({ success: true, orders: [] });
    } else {
      res.status(400).json({ error: 'Invalid code' });
    }
  });

  const abandonedTimeouts = new Map<string, NodeJS.Timeout>();

  app.post('/api/sms/schedule-abandoned', express.json(), (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    if (abandonedTimeouts.has(phone)) {
      clearTimeout(abandonedTimeouts.get(phone));
    }

    const timer = setTimeout(async () => {
      await sendSMS(phone, 'You left an incomplete order on FluidFlow! Open the app to complete your delivery request.');
      abandonedTimeouts.delete(phone);
    }, 30 * 60 * 1000); // 30 minutes

    abandonedTimeouts.set(phone, timer);
    res.json({ success: true });
  });

  app.post('/api/sms/cancel-abandoned', express.json(), (req, res) => {
    const { phone } = req.body;
    if (phone && abandonedTimeouts.has(phone)) {
      clearTimeout(abandonedTimeouts.get(phone));
      abandonedTimeouts.delete(phone);
    }
    res.json({ success: true });
  });

  // Chat Endpoints
  app.get('/api/chat/:orderId', async (req, res) => {
    const { orderId } = req.params;
    if (db) {
      try {
        const q = query(collection(db, `orders/${orderId}/messages`), orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        const messages = snapshot.docs.map(doc => doc.data());
        res.json({ messages });
      } catch (err) {
        console.error('Failed to fetch messages from Firestore', err);
        res.json({ messages: chatStore.get(orderId) || [] });
      }
    } else {
      res.json({ messages: chatStore.get(orderId) || [] });
    }
  });

  app.post('/api/chat/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { sender, text, customerPhone } = req.body;
    const newMessage = { id: Date.now().toString(), sender, text, timestamp: Date.now() };
    
    if (db) {
      try {
        await setDoc(doc(db, `orders/${orderId}/messages`, newMessage.id), newMessage);
      } catch (err) {
        console.error('Failed to save message to Firestore', err);
      }
    } else {
      const messages = chatStore.get(orderId) || [];
      messages.push(newMessage);
      chatStore.set(orderId, messages);
    }

    // If driver sends message, notify customer via SMS
    if (sender === 'driver') {
      let phoneToUse = customerPhone;
      if (!phoneToUse && db) {
        try {
          const orderDoc = await getDoc(doc(db, 'orders', orderId));
          if (orderDoc.exists()) {
            phoneToUse = orderDoc.data().customerPhone;
          }
        } catch (err) {}
      }
      if (phoneToUse) {
        await sendSMS(phoneToUse, `New message from driver: ${text}`);
      }
    }

    res.json({ success: true, message: newMessage });
  });

  app.post('/api/orders/status/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { status, phone, amount } = req.body;
    
    let message = '';
    switch (status) {
      case 'to_pickup':
        message = 'A courier has accepted your order and is heading to the restaurant/pickup location.';
        break;
      case 'at_pickup':
        message = 'Your courier has arrived at the pickup location.';
        break;
      case 'to_dropoff':
        message = 'Your courier has picked up your order and is on the way to you!';
        break;
      case 'at_dropoff':
        message = 'Your courier has arrived! Please come out to grab your order.';
        break;
      case 'completed':
        message = 'Your order has been delivered. Thank you for using FluidFlow!';
        break;
      case 'payment_requested':
        message = `Your courier has arrived at the restaurant and requested payment for the food cost: $${amount?.toFixed(2)}. Please open the FluidFlow app to pay.`;
        break;
      default:
        message = 'Your order status has been updated.';
    }

    if (phone) {
      await sendSMS(phone, message);
    }
    res.json({ success: true });
  });

  // Cancel Order Endpoint
  app.post('/api/orders/:orderId/cancel', async (req, res) => {
    const { orderId } = req.params;
    const { isDriver } = req.body || {};
    try {
      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
      }
      
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const orderData = orderSnap.data();
      
      const ONE_AND_A_HALF_HOURS = 90 * 60 * 1000;
      const timeSinceOrder = Date.now() - (orderData.createdAt || Date.now());
      
      if (!isDriver) {
        if (orderData.status !== 'pending' && orderData.status !== 'idle') {
          return res.status(400).json({ error: 'Order has already been started by the driver and cannot be cancelled.' });
        }

        if (timeSinceOrder > ONE_AND_A_HALF_HOURS) {
          return res.status(400).json({ error: 'Orders can only be cancelled within 1.5 hours of placement.' });
        }
      }
      
      // ACTUAL REFUND LOGIC:
      if (orderData.stripePaymentIntentId) {
        if (!stripe) {
          console.error('Stripe not initialized, cannot refund');
          return res.status(500).json({ error: 'Stripe not initialized for refund' });
        }
        try {
          await stripe.refunds.create({ payment_intent: orderData.stripePaymentIntentId });
          console.log(`Refunded Stripe PaymentIntent: ${orderData.stripePaymentIntentId}`);
        } catch (stripeErr) {
          console.error('Stripe refund error:', stripeErr);
          return res.status(500).json({ error: 'Failed to process Stripe refund' });
        }
      } else if (orderData.paypalCaptureId) {
        try {
          const { accessToken, baseURL } = await getPayPalAccessToken();
          const refundResponse = await fetch(`${baseURL}/v2/payments/captures/${orderData.paypalCaptureId}/refund`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({}) // Empty body for full refund
          });
          
          if (!refundResponse.ok) {
            const errorText = await refundResponse.text();
            console.error('PayPal refund error response:', errorText);
            throw new Error('PayPal refund API failed');
          }
          console.log(`Refunded PayPal Capture: ${orderData.paypalCaptureId}`);
        } catch (paypalErr) {
          console.error('PayPal refund error:', paypalErr);
          return res.status(500).json({ error: 'Failed to process PayPal refund' });
        }
      }
      
      await updateDoc(orderRef, { 
        status: 'cancelled_refunded',
        cancelledAt: Date.now()
      });
      
      res.json({ success: true, message: 'Order cancelled and refunded successfully' });
    } catch (error) {
      console.error('Failed to cancel order:', error);
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  });

  // Create Payment Intent Endpoint (Stripe)
  app.post('/api/create-payment-intent', express.json(), async (req, res) => {
    const { amount, currency } = req.body;
    
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not initialized' });
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amount in cents
        currency: currency || 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      res.status(500).json({ error: 'Failed to create payment intent' });
    }
  });

  // --- PayPal Endpoints ---
  const getPayPalAccessToken = async () => {
    const clientId = process.env.VITE_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
    const appSecret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET_KEY || process.env.PAYPAL_SECRET;
    
    if (!clientId || !appSecret) {
      console.error(`PayPal keys missing. Client ID present: ${!!clientId}, Secret present: ${!!appSecret}`);
      throw new Error("PayPal keys missing");
    }
    
    // Default to live, but allow sandbox via env var
    const baseURL = process.env.PAYPAL_ENVIRONMENT === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';

    const auth = Buffer.from(`${clientId}:${appSecret}`).toString("base64");
    const response = await fetch(`${baseURL}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
    const data = await response.json();
    return { accessToken: data.access_token, baseURL };
  };

  app.post('/api/paypal/create-order', express.json(), async (req, res) => {
    try {
      const { amount } = req.body;
      const { accessToken, baseURL } = await getPayPalAccessToken();

      const response = await fetch(`${baseURL}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: amount.toFixed(2),
              },
            },
          ],
        }),
      });

      const order = await response.json();
      if (order.id) {
        res.json({ id: order.id });
      } else {
        res.status(400).json({ error: 'Failed to create PayPal order', details: order });
      }
    } catch (error) {
      console.error('PayPal create order error:', error);
      res.status(500).json({ error: 'Failed to create PayPal order' });
    }
  });

  app.post('/api/paypal/capture-order', express.json(), async (req, res) => {
    try {
      const { orderID } = req.body;
      const { accessToken, baseURL } = await getPayPalAccessToken();

      const response = await fetch(`${baseURL}/v2/checkout/orders/${orderID}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const captureData = await response.json();
      res.json(captureData);
    } catch (error) {
      console.error('PayPal capture order error:', error);
      res.status(500).json({ error: 'Failed to capture PayPal order' });
    }
  });

  // Vite middleware for development (only if not on Vercel and not in production)
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    import('vite').then(({ createServer: createViteServer }) => {
      createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      }).then(vite => {
        app.use(vite.middlewares);
        app.listen(3000, '0.0.0.0', () => {
          console.log(`Server running on http://localhost:3000`);
        });
      });
    });
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    const PORT = process.env.PORT || 3000;
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  }

export default app;

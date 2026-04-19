export type OrderStatus = 'already_ordered' | 'order_for_me' | null;

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Coupon {
  id: number;
  code: string;
  description: string;
  discount: number | 'free_delivery';
}

export interface OrderState {
  step: number;
  date: Date | undefined;
  timeSlot: string | null;
  status: OrderStatus;
  needsPhoneCall: boolean;
  orderDetails: string;
  receiptImage: string | null;
  pickupAddress: string;
  pickupCoords: Coordinates | null;
  pickupNotes?: string;
  deliveryAddress: string;
  deliveryCoords: Coordinates | null;
  deliveryNotes?: string;
  deliveryFee: number;
  appliedCoupon: Coupon | null;
  customerPhone?: string;
  customerName?: string;
  uid?: string;
  id?: string;
  createdAt?: number;
  tip?: number;
}

export const INITIAL_ORDER_STATE: OrderState = {
  step: 1,
  date: new Date(),
  timeSlot: null,
  status: null,
  needsPhoneCall: false,
  orderDetails: '',
  receiptImage: null,
  pickupAddress: '',
  pickupCoords: null,
  pickupNotes: '',
  deliveryAddress: '',
  deliveryCoords: null,
  deliveryNotes: '',
  deliveryFee: 15.00, // Default base fee, will be recalculated
  appliedCoupon: null,
  customerPhone: '',
  tip: 0,
};

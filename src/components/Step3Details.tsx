import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { OrderState } from '../types';
import { Upload, FileText, Phone, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  order: OrderState;
  updateOrder: (updates: Partial<OrderState>) => void;
  onNext: () => void;
}

export default function Step3Details({ order, updateOrder, onNext }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      // Simulate upload
      setTimeout(() => {
        const reader = new FileReader();
        reader.onloadend = () => {
          updateOrder({ receiptImage: reader.result as string });
          setIsUploading(false);
          toast.success('Receipt uploaded successfully');
        };
        reader.readAsDataURL(file);
      }, 1000);
    }
  };

  if (order.status === 'already_ordered') {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-serif">Order Confirmation</h2>
          <p className="text-white/50">Please upload a screenshot of your receipt or add order notes.</p>
        </div>

        <div className="space-y-6">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`relative h-48 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 cursor-pointer overflow-hidden ${
              order.receiptImage ? 'border-brand-gold/50 bg-brand-gold/5' : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            {order.receiptImage ? (
              <>
                <img src={order.receiptImage} alt="Receipt" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="p-3 rounded-full bg-brand-gold text-brand-dark">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium">Image Uploaded</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white/60 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateOrder({ receiptImage: null });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-full bg-white/5 text-white/40">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Click to upload</p>
                  <p className="text-xs text-white/40">PNG, JPG or PDF up to 10MB</p>
                </div>
              </>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>

          <div className="relative rounded-3xl overflow-hidden shadow-inner">
            <div className="absolute top-4 left-4 p-2 rounded-lg bg-brand-gold text-brand-dark z-10 shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
            <textarea
              value={order.orderDetails}
              onChange={(e) => updateOrder({ orderDetails: e.target.value })}
              placeholder="Add notes for the driver (e.g., order name, order number, special instructions)..."
              className="w-full h-32 p-6 pl-16 pt-5 rounded-3xl notepad-bg text-brand-dark font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
            />
          </div>
        </div>

        <Button
          disabled={(!order.receiptImage && !order.orderDetails.trim()) || isUploading}
          onClick={onNext}
          className="w-full h-14 rounded-2xl bg-white text-brand-dark hover:bg-brand-gold transition-all text-lg font-medium"
        >
          {isUploading ? 'Uploading...' : 'Continue'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-serif">What are we getting?</h2>
        <p className="text-white/50">Describe your exact order details or attach an image below.</p>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <div className="absolute -top-3 -left-3 p-2 rounded-lg bg-brand-gold text-brand-dark z-10 shadow-lg">
            <FileText className="w-4 h-4" />
          </div>
          <textarea
            value={order.orderDetails}
            onChange={(e) => updateOrder({ orderDetails: e.target.value })}
            placeholder="Example: 2x Double Cheeseburgers (no onions), 1x Large Fries, 1x Vanilla Shake..."
            className="w-full h-48 p-8 pt-10 rounded-3xl notepad-bg text-brand-dark font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-gold/50 shadow-inner"
          />
        </div>

        <div 
          onClick={() => fileInputRef.current?.click()}
          className={`relative h-32 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 cursor-pointer overflow-hidden ${
            order.receiptImage ? 'border-brand-gold/50 bg-brand-gold/5' : 'border-white/10 bg-white/5 hover:bg-white/10'
          }`}
        >
          {order.receiptImage ? (
            <>
              <img src={order.receiptImage} alt="Reference" className="absolute inset-0 w-full h-full object-cover opacity-40" />
              <div className="relative z-10 flex flex-col items-center gap-1">
                <div className="p-2 rounded-full bg-brand-gold text-brand-dark">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">Image Attached</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-white/60 hover:text-white h-6 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateOrder({ receiptImage: null });
                  }}
                >
                  Remove
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 rounded-full bg-white/5 text-white/40">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Attach reference image (optional)</p>
              </div>
            </>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileChange} 
          />
        </div>

        <Card className="p-6 glass-card border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${order.needsPhoneCall ? 'bg-brand-gold text-brand-dark' : 'bg-white/5 text-white/40'}`}>
              <Phone className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <Label htmlFor="phone-call" className="text-sm font-medium">Order with me</Label>
              <p className="text-xs text-white/40">Stay on the phone while I order</p>
            </div>
          </div>
          <Switch 
            id="phone-call" 
            checked={order.needsPhoneCall}
            onCheckedChange={(checked) => updateOrder({ needsPhoneCall: checked })}
          />
        </Card>
      </div>

      <Button
        disabled={(!order.orderDetails.trim() && !order.receiptImage) || isUploading}
        onClick={onNext}
        className="w-full h-14 rounded-2xl bg-white text-brand-dark hover:bg-brand-gold transition-all text-lg font-medium"
      >
        {isUploading ? 'Uploading...' : 'Continue'}
      </Button>
    </div>
  );
}

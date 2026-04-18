import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, Eye, Database, Share2, ShieldCheck, Smartphone, MapPin } from 'lucide-react';

export default function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-10 pb-24 max-w-3xl mx-auto">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit -ml-4 text-brand-gold hover:text-white" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to FluidFlow
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-brand-gold/10">
            <Lock className="w-8 h-8 text-brand-gold" />
          </div>
          <div>
            <h1 className="text-4xl font-serif text-white">Privacy Policy</h1>
            <p className="text-white/40 text-sm">Last updated: April 17, 2026</p>
          </div>
        </div>
      </div>

      <div className="prose prose-invert max-w-none space-y-8 text-white/80 leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-brand-gold" />
            1. Introduction
          </h2>
          <p>
            FluidFlow ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how your personal information is collected, used, and disclosed by FluidFlow.
          </p>
          <p>
            By accessing or using our Service, you signify that you have read, understood, and agree to our collection, storage, use, and disclosure of your personal information as described in this Privacy Policy and our Terms of Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-gold" />
            2. Information We Collect
          </h2>
          <p>We collect information you provide directly to us, such as when you create or modify your account, request delivery services, contact customer support, or otherwise communicate with us.</p>
          
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-brand-gold" />
                Personal Info
              </h3>
              <p className="text-xs text-white/60">Name, email address, phone number, postal address, profile picture, payment method, and other information you choose to provide.</p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <h3 className="font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-gold" />
                Location Data
              </h3>
              <p className="text-xs text-white/60">When you use the Services for delivery, we collect precise location data about the delivery from the FluidFlow app used by the Driver.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-gold" />
            3. Use of Information
          </h2>
          <p>Internal use of information is primarily to provide, maintain, and improve our Services, such as to facilitate payments, send receipts, provide products and services you request (and send related information), develop new features, and provide customer support.</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Service Fulfillment:</strong> To process and deliver your orders accurately.</li>
            <li><strong>Safety & Security:</strong> To enhance the safety and security of our users and services.</li>
            <li><strong>Customer Support:</strong> To investigate and address user concerns.</li>
            <li><strong>Communications:</strong> To send you communications we think will be of interest to you.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-brand-gold" />
            4. Sharing of Information
          </h2>
          <p>We may share the information we collect about you as described in this statement or as described at the time of collection or sharing, including as follows:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>With Drivers:</strong> To enable them to provide the Services you request. This includes your name and delivery location.</li>
            <li><strong>With Third Parties:</strong> To provide you a service you requested through a partnership or promotional offering.</li>
            <li><strong>With Third Party Service Providers:</strong> Who are working on our behalf and require access to your information to carry out that work.</li>
            <li><strong>For Legal Reasons:</strong> If we believe disclosure is in accordance with, or required by, any applicable law, regulation, or legal process.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-gold" />
            5. Your Data Rights
          </h2>
          <p>
            You may correct your account information at any time by logging into your online or in-app account. If you wish to cancel your account, please email us at support@fluidflow.delivery. Please note that in some cases we may retain certain information about you as required by law, or for legitimate business purposes to the extent permitted by law.
          </p>
        </section>
      </div>
      
      <div className="p-8 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 text-center space-y-4">
        <p className="text-brand-dark font-medium">Your data security is our top priority.</p>
        <p className="text-brand-dark/60 text-xs px-12">We use 256-bit encryption and industry-leading security standards to keep your information safe.</p>
      </div>
    </div>
  );
}

import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck, Scale, FileText, AlertTriangle, CreditCard, UserCheck, HelpCircle } from 'lucide-react';

export default function TermsOfService({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-10 pb-24 max-w-3xl mx-auto">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit -ml-4 text-brand-gold hover:text-white" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to FluidFlow
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-brand-gold/10">
            <Scale className="w-8 h-8 text-brand-gold" />
          </div>
          <div>
            <h1 className="text-4xl font-serif text-white">Terms of Service</h1>
            <p className="text-white/40 text-sm">Effective Date: April 17, 2026</p>
          </div>
        </div>
      </div>

      <div className="prose prose-invert max-w-none space-y-8 text-white/80 leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-gold" />
            1. Contractual Relationship
          </h2>
          <p>
            These Terms of Service ("Terms") govern the access or use by you, an individual, from within any country in the world of applications, websites, content, products, and services (the "Services") made available by FluidFlow ("FluidFlow", "we", "us").
          </p>
          <p className="font-bold text-white uppercase text-xs tracking-widest bg-white/5 p-4 rounded-xl border border-white/10">
            PLEASE READ THESE TERMS CAREFULLY BEFORE ACCESSING OR USING THE SERVICES.
          </p>
          <p>
            Your access and use of the Services constitutes your agreement to be bound by these Terms, which establishes a contractual relationship between you and FluidFlow. If you do not agree to these Terms, you may not access or use the Services. These Terms expressly supersede prior agreements or arrangements with you.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-gold" />
            2. The Services
          </h2>
          <p>
            The Services constitute a technology platform that enables users of FluidFlow's mobile applications or websites provided as part of the Services (each, an "Application") to arrange and schedule logistics services with independent third-party providers of such services, including independent third-party logistics providers under agreement with FluidFlow ("Third Party Providers").
          </p>
          <p>
            YOU ACKNOWLEDGE THAT FLUIDFLOW DOES NOT PROVIDE LOGISTICS SERVICES OR FUNCTION AS A LOGISTICS CARRIER AND THAT ALL SUCH LOGISTICS SERVICES ARE PROVIDED BY INDEPENDENT THIRD-PARTY CONTRACTORS WHO ARE NOT EMPLOYED BY FLUIDFLOW.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-gold" />
            3. Your Use of the Services
          </h2>
          <h3 className="text-lg font-bold text-white mt-4">User Accounts</h3>
          <p>
            In order to use most aspects of the Services, you must register for and maintain an active personal user Services account ("Account"). You must be at least 18 years of age, or the age of legal majority in your jurisdiction (if different than 18), to obtain an Account. Account registration requires you to submit to FluidFlow certain personal information, such as your name, address, mobile phone number and age, as well as at least one valid payment method.
          </p>
          <h3 className="text-lg font-bold text-white mt-4">User Requirements and Conduct</h3>
          <p>
            The Service is not available for use by persons under the age of 18. You may not authorize third parties to use your Account, and you may not allow persons under the age of 18 to receive logistics services from Third Party Providers unless they are accompanied by you. You may not assign or otherwise transfer your Account to any other person or entity.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-gold" />
            4. Payment
          </h2>
          <p>
            You understand that use of the Services may result in charges to you for the services or goods you receive from a Third Party Provider ("Charges"). After you have received services or goods obtained through your use of the Service, FluidFlow will facilitate your payment of the applicable Charges on behalf of the Third Party Provider as such Third Party Provider's limited payment collection agent.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Delivery Fees:</strong> Calculated based on distance, time, and service demand.</li>
            <li><strong>Item Costs:</strong> For "Shop for me" orders, you are responsible for the full retail cost of items plus applicable taxes.</li>
            <li><strong>Tips:</strong> You may elect to provide additional payment as a gratuity to any Third Party Provider who provides you with services.</li>
            <li><strong>Refunds:</strong> Charges paid by you are final and non-refundable, unless otherwise determined by FluidFlow.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-brand-gold" />
            5. Disclaimers; Limitation of Liability; Indemnity
          </h2>
          <h3 className="text-lg font-bold text-white mt-4">Disclaimer</h3>
          <p className="text-sm italic text-white/60">
            THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE." FLUIDFLOW DISCLAIMS ALL REPRESENTATIONS AND WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, NOT EXPRESSLY SET OUT IN THESE TERMS, INCLUDING THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT.
          </p>
          <h3 className="text-lg font-bold text-white mt-4">Limitation of Liability</h3>
          <p>
            FLUIDFLOW SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, LOST DATA, PERSONAL INJURY, OR PROPERTY DAMAGE RELATED TO, IN CONNECTION WITH, OR OTHERWISE RESULTING FROM ANY USE OF THE SERVICES, REGARDLESS OF THE NEGLIGENCE (EITHER ACTIVE, AFFIRMATIVE, SOLE, OR CONCURRENT) OF FLUIDFLOW.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-brand-gold" />
            6. Governing Law; Arbitration
          </h2>
          <p>
            Except as otherwise set forth in these Terms, these Terms shall be exclusively governed by and construed in accordance with the laws of the jurisdiction in which the dispute arises.
          </p>
        </section>
      </div>
      
      <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center space-y-4">
        <p className="text-white/60 text-sm">Have questions about our terms?</p>
        <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
          Contact Legal Support
        </Button>
      </div>
    </div>
  );
}

'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';


/* =========================================================
   Types
   ========================================================= */

interface Product {
  id: string;
  name: string;
  price: number;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (
    event: string,
    callback: (response: unknown) => void
  ) => void;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;

  handler: (response: RazorpayResponse) => Promise<void>;

  prefill: {
    name: string;
    email: string;
    contact?: string;
  };

  theme: {
    color: string;
  };

  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayConstructor {
  new (options: RazorpayOptions): RazorpayInstance;
}

/* Tell TypeScript that Razorpay exists on window */
declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/* =========================================================
   Razorpay Script Loader
   ========================================================= */

const loadRazorpay = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');

    script.src =
      'https://checkout.razorpay.com/v1/checkout.js';

    script.onload = () => {
      resolve(true);
    };

    script.onerror = () => {
      resolve(false);
    };

    document.body.appendChild(script);
  });
};

/* =========================================================
   Checkout Button
   ========================================================= */

export default function CheckoutButton({
  product,
  rzpKeyId,
}: {
  product: Product;
  rzpKeyId: string;
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    null
  );

  /* =======================================================
     Payment Handler
     ======================================================= */

  const handlePayment = async (e: FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setErrorMsg(null);

    try {
      /* -----------------------------------------------------
         1. Load Razorpay
         ----------------------------------------------------- */

      const isScriptLoaded = await loadRazorpay();

      if (!isScriptLoaded || !window.Razorpay) {
        setErrorMsg(
          'Failed to load the payment gateway. Please check your connection.'
        );

        setLoading(false);
        return;
      }

      /* -----------------------------------------------------
         2. Create Razorpay Order
         ----------------------------------------------------- */

      const res = await fetch('/api/create-order', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          price: product.price,
          customerName,
          customerEmail: email,
          customerPhone,
          productId: product.id,
        }),
      });

      const orderResult: { orderId?: string; error?: string } =
        await res.json();
      if (!res.ok || !orderResult.orderId) {
        throw new Error(orderResult.error || 'Failed to create order on the server.');
      }
      const orderId = orderResult.orderId;

      /* -----------------------------------------------------
         3. Razorpay Configuration
         ----------------------------------------------------- */

      const options: RazorpayOptions = {
        key: rzpKeyId,

        amount: product.price * 100,

        currency: 'INR',

        name: 'Studio Maya',

        description: product.name,

        order_id: orderId,

        /* ---------------------------------------------------
           4. Payment Success Handler
           --------------------------------------------------- */

        handler: async (
          response: RazorpayResponse
        ) => {
          setIsVerifying(true);
          setErrorMsg(null);

          try {
            /* -----------------------------------------------
               5. Verify Payment
               ----------------------------------------------- */

            const verifyRes = await fetch(
              '/api/verify-payment',
              {
                method: 'POST',

                headers: {
                  'Content-Type': 'application/json',
                },

                body: JSON.stringify({
                  razorpay_payment_id:
                    response.razorpay_payment_id,

                  razorpay_order_id:
                    response.razorpay_order_id,

                  razorpay_signature:
                    response.razorpay_signature,

                  email,

                  productId: product.id,
                }),
              }
            );

            /* -----------------------------------------------
               6. Verification Result
               ----------------------------------------------- */

            const verifyResult: { error?: string } = await verifyRes.json();
            if (verifyRes.ok) {
              router.push('/thank-you');
            } else {
              setErrorMsg(
                verifyResult.error || 'Payment verification failed.'
              );

              setIsVerifying(false);
              setLoading(false);
            }
          } catch (error) {
            console.error(error);

            setErrorMsg(
              'Something went wrong during verification.'
            );

            setIsVerifying(false);
            setLoading(false);
          }
        },

        /* ---------------------------------------------------
           Customer Information
           --------------------------------------------------- */

        prefill: {
          name: customerName,
          email,
          contact: customerPhone,
        },

        /* ---------------------------------------------------
           Razorpay Theme
           --------------------------------------------------- */

        theme: {
          color: '#000000',
        },

        /* ---------------------------------------------------
           Modal Configuration
           --------------------------------------------------- */
        
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };

      /* -----------------------------------------------------
         7. Create Razorpay Instance
         ----------------------------------------------------- */

      const rzp = new window.Razorpay(options);

      /* -----------------------------------------------------
         8. Handle Payment Failure
         ----------------------------------------------------- */

      rzp.on('payment.failed', () => {
        setLoading(false);

        setErrorMsg(
          'Payment failed. Please try again.'
        );
      });

      /* -----------------------------------------------------
         9. Open Razorpay
         ----------------------------------------------------- */

      rzp.open();
    } catch (error) {
      console.error(error);

      setErrorMsg(
        'Something went wrong loading the payment gateway.'
      );

      setLoading(false);
    }
  };

  /* =========================================================
     UI
     ========================================================= */

  return (
    <>
      {/* =====================================================
          Buy Now Button
          ===================================================== */}

      <button
        onClick={() => {
          setShowModal(true);
          setErrorMsg(null);
        }}
        className="w-full bg-black text-white px-5 py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors text-lg"
      >
        Buy Now →
      </button>

      {/* =====================================================
          Checkout Modal
          ===================================================== */}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative">

            {/* =================================================
                Close Button
                ================================================= */}

            {!isVerifying && (
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl"
                type="button"
              >
                ✕
              </button>
            )}

            {/* =================================================
                Error Message
                ================================================= */}

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium text-center border border-red-100">
                {errorMsg}
              </div>
            )}

            {/* =================================================
                Verification Screen
                ================================================= */}

            {isVerifying ? (
              <div className="text-center py-8">

                <div className="w-12 h-12 border-4 border-gray-100 border-t-black rounded-full animate-spin mx-auto mb-6"></div>

                <h3 className="text-xl font-bold mb-2">
                  Verifying Payment...
                </h3>

                <p className="text-gray-500 text-sm">
                  Please dont close this window. We are
                  preparing your files.
                </p>

              </div>
            ) : (
              <>
                {/* =============================================
                    Customer Details
                    ============================================= */}

                <h3 className="text-2xl font-bold mb-2">
                  Enter your details
                </h3>

                <p className="text-gray-500 text-sm mb-6">
                  We will send your product and order details to
                  this email after successful payment.
                </p>

                {/* =============================================
                    Form
                    ============================================= */}

                <form onSubmit={handlePayment}>

                  {/* -------------------------------------------
                      Full Name
                      ------------------------------------------- */}

                  <div className="mb-4 text-left">

                    <label className="block text-sm font-medium mb-1.5 text-gray-700">
                      Full Name
                    </label>

                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) =>
                        setCustomerName(e.target.value)
                      }
                      placeholder="e.g. Sai Ganesh"
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                    />

                  </div>

                  {/* -------------------------------------------
                      Email
                      ------------------------------------------- */}

                  <div className="mb-6 text-left">

                    <label className="block text-sm font-medium mb-1.5 text-gray-700">
                      Email address
                    </label>

                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) =>
                        setEmail(e.target.value)
                      }
                      placeholder="you@example.com"
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                    />

                  </div>

                  {/* -------------------------------------------
                      Phone Number
                      ------------------------------------------- */}

                  <div className="mb-6 text-left">

                    <label className="block text-sm font-medium mb-1.5 text-gray-700">
                      Phone Number
                    </label>

                    <input
                      type="tel"
                      required
                      pattern="[0-9]{10,15}"
                      title="Please enter a valid phone number"
                      value={customerPhone}
                      onChange={(e) =>
                        setCustomerPhone(e.target.value)
                      }
                      placeholder="e.g. 9876543210"
                      className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                    />

                  </div>

                  {/* -------------------------------------------
                      Continue to Payment
                      ------------------------------------------- */}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black text-white px-5 py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-400"
                  >
                    {loading
                      ? 'Loading gateway...'
                      : 'Continue to Payment →'}
                  </button>

                </form>

                {/* =============================================
                    Secure Payment Notice
                    ============================================= */}

                <div className="mt-6 text-xs text-gray-400 flex items-center justify-center gap-2">

                  <span>
                    Secure payment powered by Razorpay
                  </span>

                  🔒

                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
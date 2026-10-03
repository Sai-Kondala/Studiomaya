'use client';
import { useState } from 'react';

export default function CheckoutButton({ product, rzpKeyId }: { product: any, rzpKeyId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false); // Tracks the post-payment wait time

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          price: product.price, 
          email: email, 
          productId: product.id 
        })
      });
      
      const { orderId } = await res.json();

      const options = {
        key: rzpKeyId,
        amount: product.price * 100, 
        currency: "INR",
        name: "Studio Maya",
        description: product.name,
        order_id: orderId,
        handler: async function (response: any) {
          // As soon as Razorpay closes, show our loading spinner
          setIsVerifying(true);
          
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                email: email,
                productId: product.id
              })
            });
            
            if (verifyRes.ok) {
              window.location.href = '/thank-you';
            } else {
              alert('Payment verification failed.');
              setIsVerifying(false);
            }
          } catch (err) {
            alert('Something went wrong during verification.');
            setIsVerifying(false);
          }
        },
        prefill: {
          email: email,
        },
        theme: {
          color: "#000000"
        }
      };

      const rzp = new (window as any).Razorpay(options);
      
      // If the user manually closes the Razorpay popup without paying, reset the loading button
      rzp.on('payment.failed', function () {
        setLoading(false);
      });
      
      rzp.open();
      
    } catch (error) {
      console.error(error);
      alert("Something went wrong loading the payment gateway.");
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className="w-full bg-black text-white px-5 py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors text-lg"
      >
        Buy Now →
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
            
            {/* Hide the close button if we are currently verifying the payment */}
            {!isVerifying && (
              <button 
                onClick={() => setShowModal(false)} 
                className="absolute top-4 right-4 text-gray-400 hover:text-black text-xl"
              >
                ✕
              </button>
            )}
            
            {isVerifying ? (
              /* New Loading Spinner UI */
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-gray-100 border-t-black rounded-full animate-spin mx-auto mb-6"></div>
                <h3 className="text-xl font-bold mb-2">Verifying Payment...</h3>
                <p className="text-gray-500 text-sm">
                  Please don't close this window. We are preparing your files.
                </p>
              </div>
            ) : (
              /* Original Email Form */
              <>
                <h3 className="text-2xl font-bold mb-2">Enter your email</h3>
                <p className="text-gray-500 text-sm mb-6">
                  We'll send your product and order details to this email after successful payment.
                </p>
                
                <form onSubmit={handlePayment}>
                  <label className="block text-sm font-medium mb-2">Email address</label>
                  <input 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="you@example.com"
                  />
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-black text-white px-5 py-3.5 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-400"
                  >
                    {loading ? 'Loading gateway...' : 'Continue to Payment →'}
                  </button>
                </form>
                
                <div className="mt-6 text-xs text-gray-400 flex items-center justify-center gap-2">
                  <span>🔒 Your email is only used for order delivery.</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
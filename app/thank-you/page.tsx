import Link from 'next/link';

export default function ThankYouPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100">
        
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        
        <h1 className="text-3xl font-extrabold mb-4">Thank you for your purchase!</h1>
        <p className="text-gray-500 mb-8">
          Your product has been sent to your email.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-8 flex items-center justify-center gap-3 border border-gray-100">
          <span className="text-xl">📩</span>
          <span className="font-medium text-gray-900">Check your inbox</span>
        </div>

        <p className="text-sm text-gray-500 mb-8">
          Please check your spam or promotions folder if you don&apos;t see the email within a few minutes.
        </p>
        
        <Link 
          href="/"
          className="block w-full bg-black text-white px-5 py-4 rounded-xl font-medium hover:bg-gray-800 transition-colors"
        >
          Back to Store
        </Link>
      </div>
    </main>
  );
}
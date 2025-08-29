"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const PaymentForm = () => {
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Check payment status for popup approach
  const checkPaymentStatus = useCallback(async (paymentIntentId: string) => {
    try {
      const res = await fetch(`/api/check-payment-status?payment_intent_id=${paymentIntentId}`);
      const data = await res.json();
      
      if (data.status === 'succeeded') {
        alert("Payment successful! Thank you for your order.");
        router.push('/userdashboard');
      } else if (data.status === 'failed') {
        setError("Payment failed. Please try again.");
      }
      
      // Clear the payment intent ID from storage
      sessionStorage.removeItem('paymentIntentId');
    } catch (error) {
      console.error("Error checking payment status:", error);
    }
  }, [router]);

  // Handle payment status when returning from payment gateway
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment_status');
    
    if (paymentStatus === 'success') {
      alert("Payment successful! Thank you for your order.");
      router.push('/userdashboard');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (paymentStatus === 'failed') {
      setError("Payment failed. Please try again or choose another payment method.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check for payment intent ID in session storage (for popup approach)
    const paymentIntentId = sessionStorage.getItem('paymentIntentId');
    if (paymentIntentId) {
      checkPaymentStatus(paymentIntentId);
    }
  }, [router, checkPaymentStatus]);

  const handlePaymentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    setError("");

    if (paymentMethod === "Cash") {
      // Simulate processing time
      setTimeout(() => {
        alert("Cash payment selected. Redirecting to dashboard...");
        router.push('/userdashboard');
        setIsProcessing(false);
      }, 1500);
    } else {
      try {
        // Determine payment method type for PayMongo
        let paymentMethodType = "card";
        if (paymentMethod === "GCash") paymentMethodType = "gcash";
        if (paymentMethod === "Maya") paymentMethodType = "paymaya";
        
        const res = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: 10000,
            description: "Order Payment",
            payment_method_type: paymentMethodType,
            return_url: `${window.location.origin}/userdashboard`
          })
        });

        const responseData = await res.json();

        if (!res.ok) {
          throw new Error(
            `Payment error: ${res.status} - ${responseData.error || 'Unknown error'}. ` +
            `${responseData.details ? JSON.stringify(responseData.details) : ''}`
          );
        }

        if (!responseData || Object.keys(responseData).length === 0) {
          throw new Error("Empty response received from server");
        }

        const checkoutUrl = responseData?.data?.attributes?.checkout_url;

        if (checkoutUrl) {
          // Redirect directly to payment gateway
          window.location.href = checkoutUrl;
        } else {
          setError("Failed to initialize online payment. No checkout URL received.");
          console.error("PayMongo Response:", responseData);
        }
      } catch (err) {
        console.error("Payment error:", err);
        setError((err as Error).message || "Error starting online payment. Please try again or use cash payment.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    setError("");
  };

  return (
    <div className="payment-container">
      <div className="payment-header">
        <h2>Choose Payment Method</h2>
      </div>
      
      <div className="payment-content">
        <form onSubmit={handlePaymentSubmit}>
          <div className="payment-methods">
            <label className={`payment-option ${paymentMethod === "Cash" ? "selected" : ""}`}>
              <input
                type="radio"
                value="Cash"
                checked={paymentMethod === "Cash"}
                onChange={() => handlePaymentMethodChange("Cash")}
                className="sr-only"
              />
              <span className="checkmark"></span>
              <div className="payment-icon">
                <i className="fas fa-money-bill-wave"></i>
              </div>
              <div className="payment-details">
                <h3>Cash Payment</h3>
                <p>Pay with cash when your order arrives</p>
              </div>
            </label>
            
            <label className={`payment-option ${paymentMethod === "Card" ? "selected" : ""}`}>
              <input
                type="radio"
                value="Card"
                checked={paymentMethod === "Card"}
                onChange={() => handlePaymentMethodChange("Card")}
                className="sr-only"
              />
              <span className="checkmark"></span>
              <div className="payment-icon">
                <i className="fas fa-credit-card"></i>
              </div>
              <div className="payment-details">
                <h3>Credit/Debit Card</h3>
                <p>Pay securely with your card</p>
              </div>
            </label>
            
            <label className={`payment-option ${paymentMethod === "GCash" ? "selected" : ""}`}>
              <input
                type="radio"
                value="GCash"
                checked={paymentMethod === "GCash"}
                onChange={() => handlePaymentMethodChange("GCash")}
                className="sr-only"
              />
              <span className="checkmark"></span>
              <div className="payment-icon">
                <i className="fas fa-mobile-alt"></i>
              </div>
              <div className="payment-details">
                <h3>GCash</h3>
                <p>Pay using your GCash wallet</p>
              </div>
            </label>
            
            <label className={`payment-option ${paymentMethod === "Maya" ? "selected" : ""}`}>
              <input
                type="radio"
                value="Maya"
                checked={paymentMethod === "Maya"}
                onChange={() => handlePaymentMethodChange("Maya")}
                className="sr-only"
              />
              <span className="checkmark"></span>
              <div className="payment-icon">
                <i className="fas fa-wallet"></i>
              </div>
              <div className="payment-details">
                <h3>Maya</h3>
                <p>Pay using your Maya wallet</p>
              </div>
            </label>
          </div>
          
          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
              <button 
                type="button" 
                className="error-close"
                onClick={() => setError("")}
                aria-label="Close error message"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}
          
          <button
            type="submit"
            className={`payment-btn ${isProcessing ? "processing" : ""}`}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Processing...
              </>
            ) : (
              <>
                <i className="fas fa-arrow-right"></i>
                Proceed to Payment
              </>
            )}
          </button>
          
          <div className="security-note">
            <i className="fas fa-lock"></i>
            <span>Your payment details are secure and encrypted</span>
          </div>
        </form>
      </div>

      <style>{`
        .payment-container {
          width: 100%;
          max-width: 500px;
          margin: 2rem auto;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        .payment-header {
          background: #4a6cf7;
          color: white;
          padding: 1.5rem;
          text-align: center;
        }
        
        .payment-header h2 {
          font-weight: 600;
          font-size: 1.8rem;
          margin: 0;
        }
        
        .payment-content {
          padding: 1.5rem;
        }
        
        .payment-methods {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .payment-option {
          border: 2px solid #e6e6e6;
          border-radius: 12px;
          padding: 1.2rem;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 1rem;
          position: relative;
        }
        
        .payment-option:hover {
          border-color: #4a6cf7;
          background-color: #f8f9ff;
        }
        
        .payment-option.selected {
          border-color: #4a6cf7;
          background-color: #f0f4ff;
        }
        
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        
        .checkmark {
          width: 22px;
          height: 22px;
          border: 2px solid #ccc;
          border-radius: 50%;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }
        
        .payment-option.selected .checkmark {
          border-color: #4a6cf7;
          background-color: #4a6cf7;
        }
        
        .checkmark:after {
          content: "✓";
          color: white;
          font-size: 14px;
          display: none;
        }
        
        .payment-option.selected .checkmark:after {
          display: block;
        }
        
        .payment-icon {
          font-size: 1.5rem;
          width: 40px;
          text-align: center;
          color: #4a6cf7;
          flex-shrink: 0;
        }
        
        .payment-details {
          flex: 1;
        }
        
        .payment-details h3 {
          font-size: 1.1rem;
          margin-bottom: 0.3rem;
          color: #333;
        }
        
        .payment-details p {
          color: #666;
          font-size: 0.9rem;
          margin: 0;
        }
        
        .payment-btn {
          width: 100%;
          padding: 1rem;
          background: #4a6cf7;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
        }
        
        .payment-btn:hover:not(:disabled) {
          background: #3a5cd8;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(58, 92, 216, 0.3);
        }
        
        .payment-btn:active {
          transform: translateY(0);
        }
        
        .payment-btn:disabled {
          opacity: 0.8;
          cursor: not-allowed;
        }
        
        .payment-btn.processing {
          background: #3a5cd8;
        }
        
        .error-message {
          background-color: #fee;
          color: #c33;
          padding: 0.8rem;
          border-radius: 8px;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-left: 4px solid #c33;
          position: relative;
        }
        
        .error-close {
          background: none;
          border: none;
          color: #c33;
          cursor: pointer;
          margin-left: auto;
          padding: 0.2rem;
          border-radius: 4px;
        }
        
        .error-close:hover {
          background-color: rgba(204, 51, 51, 0.1);
        }
        
        .security-note {
          text-align: center;
          margin-top: 1.2rem;
          color: #666;
          font-size: 0.9rem;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
        }
        
        /* Responsive adjustments */
        @media (max-width: 576px) {
          .payment-container {
            margin: 1rem;
            max-width: none;
          }
          
          .payment-header {
            padding: 1.2rem;
          }
          
          .payment-header h2 {
            font-size: 1.5rem;
          }
          
          .payment-content {
            padding: 1.2rem;
          }
          
          .payment-option {
            padding: 1rem;
          }
        }
        
        @media (max-width: 400px) {
          .payment-option {
            flex-direction: column;
            text-align: center;
            gap: 0.7rem;
          }
          
          .payment-details h3 {
            font-size: 1rem;
          }
          
          .payment-details p {
            font-size: 0.8rem;
          }
          
          .payment-btn {
            padding: 0.8rem;
            font-size: 1rem;
          }
        }
        
        /* Animation */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .payment-option {
          animation: fadeIn 0.5s ease-out;
        }
        
        .payment-option:nth-child(2) {
          animation-delay: 0.1s;
        }
     `}</style>

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    </div>
  );
};

export default PaymentForm;
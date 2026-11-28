import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import {
  createOrder,
  verifyPayment,
  createRazorpayOrder,
  verifyRazorpayPayment,
  loadRazorpayScript,
} from '../services/paymentService';
import './RazorpayCheckoutButton.css';

/**
 * RazorpayCheckoutButton — Standard Web Checkout Button Component
 *
 * Implements the 3-step Razorpay Standard Checkout flow:
 * 1. Creates order via backend (POST /api/create-order or POST /api/payments/razorpay/order)
 * 2. Launches Razorpay Standard Checkout modal with order_id
 * 3. On success, verifies HMAC-SHA256 signature with backend (POST /api/verify-payment)
 *
 * @param {Object} props
 * @param {number} [props.amount] - Payment amount in paise (minimum 100 paise)
 * @param {string} [props.currency='INR'] - Currency code
 * @param {string} [props.planId] - Optional Plan ID for gym membership checkout
 * @param {string} [props.name='FitMax Gym'] - Checkout modal merchant title
 * @param {string} [props.description='Gym Membership Payment'] - Description
 * @param {Object} [props.prefill={}] - { name, email, contact }
 * @param {string} [props.themeColor='#0066ff'] - Modal brand color
 * @param {string} [props.token] - Optional Firebase ID token
 * @param {string} [props.buttonText='Pay with Razorpay'] - Button label
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {Function} [props.onSuccess] - Callback on signature verification success
 * @param {Function} [props.onFailure] - Callback on error or dismissal
 */
export default function RazorpayCheckoutButton({
  amount,
  currency = 'INR',
  planId,
  isRenewal = false,
  name = 'IRONCORE Gym',
  description = 'Gym Membership Payment',
  prefill = {},
  themeColor = '#0284c7',
  token = null,
  buttonText = 'Pay with Razorpay',
  className = '',
  disabled = false,
  onSuccess,
  onFailure,
}) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (loading || disabled) return;

    setLoading(true);

    try {
      // 1. Ensure Razorpay checkout.js SDK is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || typeof window.Razorpay === 'undefined') {
        throw new Error(
          'Razorpay checkout SDK could not be loaded. Please check your internet connection.'
        );
      }

      // 2. Create order on backend
      let orderData;
      let orderId;
      let orderAmount;
      let orderCurrency;
      let keyId =
        import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_U0JejejMXMSerJ';

      if (planId && token) {
        // Authenticated gym membership purchase
        const res = await createRazorpayOrder({ planId, isRenewal }, token);
        orderId = res.orderId;
        orderAmount = res.amount;
        orderCurrency = res.currency || currency;
        keyId = res.keyId || keyId;
        orderData = res;
      } else {
        // Standard Checkout via /api/create-order
        const orderAmountPaise = Number(amount) || 100;
        const res = await createOrder({
          amount: orderAmountPaise,
          currency,
          receipt: `rcpt_${Date.now().toString().slice(-8)}`,
        });
        orderId = res.order_id || res.id;
        orderAmount = res.amount;
        orderCurrency = res.currency || currency;
        keyId = res.key_id || keyId;
        orderData = res;
      }

      if (!orderId) {
        throw new Error('Failed to retrieve order ID from server');
      }

      // 3. Configure Razorpay modal options
      const options = {
        key: keyId,
        amount: orderAmount,
        currency: orderCurrency || 'INR',
        name,
        description,
        order_id: orderId,
        prefill: {
          name: prefill.name || '',
          email: prefill.email || '',
          contact: prefill.contact || prefill.phone || '',
        },
        theme: {
          color: themeColor,
        },
        handler: async function (response) {
          try {
            // 4. Verify payment signature on backend
            let verifyResult;
            if (planId && token) {
              verifyResult = await verifyRazorpayPayment(
                {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                },
                token
              );
            } else {
              verifyResult = await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
            }

            setLoading(false);
            if (onSuccess) {
              onSuccess({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                verification: verifyResult,
                orderData,
              });
            }
          } catch (verifyErr) {
            setLoading(false);
            if (onFailure) {
              onFailure(verifyErr);
            }
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            if (onFailure) {
              onFailure(new Error('Payment checkout window was cancelled.'));
            }
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on('payment.failed', function (resp) {
        setLoading(false);
        const errDesc =
          resp.error?.description || 'Payment was declined or failed at gateway.';
        if (onFailure) {
          onFailure(new Error(errDesc));
        }
      });

      rzpInstance.open();
    } catch (err) {
      setLoading(false);
      if (onFailure) {
        onFailure(err);
      }
    }
  };

  return (
    <button
      type="button"
      className={`razorpay-checkout-button ${className}`}
      onClick={handleCheckout}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <Loader2 className="rzp-spinner" size={18} />
          <span>Opening Gateway…</span>
        </>
      ) : (
        <>
          <CreditCard size={18} />
          <span>{buttonText}</span>
        </>
      )}
    </button>
  );
}


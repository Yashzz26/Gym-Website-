// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import RazorpayCheckoutButton from '../components/RazorpayCheckoutButton';
import * as paymentService from '../services/paymentService';

describe('RazorpayCheckoutButton Component', () => {
  let mockRazorpayInstance;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockRazorpayInstance = {
      open: vi.fn(),
      on: vi.fn(),
    };

    window.Razorpay = vi.fn(function () {
      return mockRazorpayInstance;
    });

    vi.spyOn(paymentService, 'loadRazorpayScript').mockResolvedValue(true);
  });

  afterEach(() => {
    delete window.Razorpay;
  });

  it('renders default button text and icon', () => {
    render(<RazorpayCheckoutButton amount={50000} />);
    expect(screen.getByText('Pay with Razorpay')).toBeInTheDocument();
  });

  it('renders custom button text', () => {
    render(
      <RazorpayCheckoutButton
        amount={150000}
        buttonText="Subscribe Now ₹1,500"
      />
    );
    expect(screen.getByText('Subscribe Now ₹1,500')).toBeInTheDocument();
  });

  it('creates order, opens modal, and verifies signature on payment completion', async () => {
    const mockOrder = {
      order_id: 'order_test_999',
      amount: 50000,
      currency: 'INR',
      key_id: 'rzp_test_U0JejejMXMSerJ',
    };

    const mockVerify = {
      success: true,
      message: 'Payment verified successfully',
    };

    vi.spyOn(paymentService, 'createOrder').mockResolvedValue(mockOrder);
    vi.spyOn(paymentService, 'verifyPayment').mockResolvedValue(mockVerify);

    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    render(
      <RazorpayCheckoutButton
        amount={50000}
        currency="INR"
        name="FitMax Gym Test"
        description="Standard Test Subscription"
        onSuccess={onSuccess}
        onFailure={onFailure}
      />
    );

    fireEvent.click(screen.getByText('Pay with Razorpay'));

    await waitFor(() => {
      expect(paymentService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          currency: 'INR',
        })
      );
      expect(window.Razorpay).toHaveBeenCalled();
      expect(mockRazorpayInstance.open).toHaveBeenCalled();
    });

    // Simulate gateway handler callback
    const optionsPassed = window.Razorpay.mock.calls[0][0];
    await act(async () => {
      await optionsPassed.handler({
        razorpay_payment_id: 'pay_test_abc123',
        razorpay_order_id: 'order_test_999',
        razorpay_signature: 'sig_mock_signature',
      });
    });

    await waitFor(() => {
      expect(paymentService.verifyPayment).toHaveBeenCalledWith({
        razorpay_order_id: 'order_test_999',
        razorpay_payment_id: 'pay_test_abc123',
        razorpay_signature: 'sig_mock_signature',
      });
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentId: 'pay_test_abc123',
          orderId: 'order_test_999',
          signature: 'sig_mock_signature',
          verification: mockVerify,
        })
      );
    });
  });

  it('handles payment signature verification failure properly', async () => {
    vi.spyOn(paymentService, 'createOrder').mockResolvedValue({
      order_id: 'order_test_err',
      amount: 10000,
      currency: 'INR',
    });

    vi.spyOn(paymentService, 'verifyPayment').mockRejectedValue(
      new Error('Invalid signature')
    );

    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    render(
      <RazorpayCheckoutButton
        amount={10000}
        onSuccess={onSuccess}
        onFailure={onFailure}
      />
    );

    fireEvent.click(screen.getByText('Pay with Razorpay'));

    await waitFor(() => {
      expect(window.Razorpay).toHaveBeenCalled();
    });

    const optionsPassed = window.Razorpay.mock.calls[0][0];
    await act(async () => {
      await optionsPassed.handler({
        razorpay_payment_id: 'pay_err',
        razorpay_order_id: 'order_test_err',
        razorpay_signature: 'sig_invalid',
      });
    });

    await waitFor(() => {
      expect(onFailure).toHaveBeenCalledWith(expect.any(Error));
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});

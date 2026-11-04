import { CreditCard } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function OnlineJoiningPage() {
  return (
    <PlaceholderScreen
      title="Online Joining & Plan Selection"
      screenNumber={1}
      role="Member"
      day="11 (Task 22)"
      icon={CreditCard}
      description="Public member-facing joining page with plan comparison (1M / 3M / 12M), optional coupon validation, Razorpay checkout integration, and automated WhatsApp welcome message."
      features={[
        'Interactive 1-month, 3-month and 12-month membership plan cards',
        'Discount coupon input and instant price calculation in integer paise',
        'Secure Razorpay checkout modal with order verification',
        'Auto-activation on verified payment with welcome confirmation',
      ]}
    />
  );
}

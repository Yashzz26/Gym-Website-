import { Receipt } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function FeesEntryPage() {
  return (
    <PlaceholderScreen
      title="Fees Entry & Receipt Generator"
      screenNumber={5}
      role="Reception"
      day="14 (Task 28)"
      icon={Receipt}
      description="Offline fee collection interface for reception staff. Search member, choose plan duration, record payment mode (Cash / UPI QR), and instantly dispatch a WhatsApp receipt."
      features={[
        'Fast auto-complete search across active, expired and new members',
        'Plan selection with auto-calculated integer paise amounts',
        'Payment method recording (Cash or Reception UPI transfer)',
        'Immediate WhatsApp digital receipt dispatch via Meta Cloud API',
      ]}
    />
  );
}

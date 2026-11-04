import { Settings } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function GymSettingsPage() {
  return (
    <PlaceholderScreen
      title="Gym Profile & Operating Settings"
      role="Owner"
      day="9 (Task 18)"
      icon={Settings}
      description="Configure core gym parameters: business name, branch contact information, operating hours, morning and evening session definitions, and QR token rotation frequencies."
      features={[
        'Gym profile (Name, address, contact WhatsApp, GSTIN, UPI ID)',
        'Morning and evening session time windows for attendance categorization',
        'QR rotation frequency (5-10 minutes) and gate display credentials',
        'Timezone configuration (Asia/Kolkata default) for timestamp audits',
      ]}
    />
  );
}

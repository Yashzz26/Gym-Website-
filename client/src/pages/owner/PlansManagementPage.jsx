import { Layers } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function PlansManagementPage() {
  return (
    <PlaceholderScreen
      title="Membership Plans Management"
      role="Owner"
      day="10 (Task 20)"
      icon={Layers}
      description="Create, configure and manage public and private membership tiers. Manage duration in months, price in integer paise, included gym perks, and active display flags."
      features={[
        'Configure 1-month, 3-month, 6-month and annual subscription options',
        'Set pricing in integer paise with tax/GST calculation rules',
        'Toggle active status to hide legacy plans from online joining',
        'Custom list of perks (Personal Training, Locker, Steam bath access)',
      ]}
    />
  );
}

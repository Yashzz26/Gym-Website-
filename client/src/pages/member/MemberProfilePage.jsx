import { User } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function MemberProfilePage() {
  return (
    <PlaceholderScreen
      title="My Membership & Profile"
      role="Member"
      day="12 (Task 24)"
      icon={User}
      description="Member self-service overview displaying active membership period, expiration date, payment history receipts, and personal fitness goals."
      features={[
        'Active subscription status, start date and renewal due date',
        'Downloadable digital receipts for all past membership fees',
        'Profile details editing (phone, emergency contact)',
        'Assigned personal trainer profile and quick contact card',
      ]}
    />
  );
}

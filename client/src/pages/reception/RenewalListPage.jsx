import { Clock } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function RenewalListPage() {
  return (
    <PlaceholderScreen
      title="Upcoming Renewals & Expiry Watch"
      screenNumber={6}
      role="Reception"
      day="17 (Task 34)"
      icon={Clock}
      description="List of members whose memberships are due to expire within 7 days. Sorted chronologically by days remaining with one-click WhatsApp renewal reminders."
      features={[
        '7-day rolling expiry queue sorted from soonest to latest',
        'Color-coded urgency pills (Critical: today/tomorrow, Warning: < 7 days)',
        'One-click template WhatsApp reminder dispatcher with message logging',
        'Direct link to Fees Entry screen with member details pre-populated',
      ]}
    />
  );
}

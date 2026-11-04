import { UserX } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function InactiveMembersPage() {
  return (
    <PlaceholderScreen
      title="Ghost & Inactive Member Watch"
      screenNumber={10}
      role="Owner"
      day="23 (Task 46)"
      icon={UserX}
      description="Lists active paying gym members who have not checked in for 7 or more consecutive days. Enables targeted retention outreach before churn."
      features={[
        'Automated detection of active memberships with zero check-ins for 7+ days',
        'Sorted chronologically by longest absence duration',
        'One-tap personalized WhatsApp retention reminder template',
        'Follow-up log tracking member response and comeback attendance',
      ]}
    />
  );
}

import { UserPlus } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function RegisterMemberPage() {
  return (
    <PlaceholderScreen
      title="In-Person Member Registration"
      role="Reception"
      day="11 (Task 21)"
      icon={UserPlus}
      description="Reception desk onboarding workflow. Enrolls new walk-in members, creates Firebase credentials, assigns starter plan, and collects initial fees."
      features={[
        'Fast onboarding form with duplicate email and phone validation',
        'Direct plan assignment and initial fee collection entry',
        'Automated welcome SMS/WhatsApp dispatch with login credentials',
        'Optional emergency contact and medical clearance collection',
      ]}
    />
  );
}

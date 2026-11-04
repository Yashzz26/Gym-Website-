import { Users } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function MyMembersPage() {
  return (
    <PlaceholderScreen
      title="Trainer's Assigned Members"
      screenNumber={7}
      role="Trainer"
      day="18 (Task 36)"
      icon={Users}
      description="Dashboard displaying all members assigned to the logged-in trainer. Shows primary fitness goal, target vs current weight delta, and weekly attendance adherence."
      features={[
        'Member cards with goal tags (Fat Loss / Muscle Gain / General Fitness)',
        'Weight tracking timeline and monthly progress delta',
        'Weekly gym attendance adherence indicator (e.g. 4/5 days visited)',
        'Direct links to customize Diet Plan and Workout routine',
      ]}
    />
  );
}

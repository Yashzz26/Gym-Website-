import { CalendarCheck } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function TodayAttendancePage() {
  return (
    <PlaceholderScreen
      title="Today's Attendance Overview"
      screenNumber={4}
      role="Reception"
      day="16 (Task 32)"
      icon={CalendarCheck}
      description="Real-time reception log of member check-ins. Shows aggregate attendance counters, Morning vs Evening session breakdown, and search-filtered entry logs."
      features={[
        'Total daily check-in counter with morning/evening split metrics',
        'Live timestamped check-in activity feed with member photos',
        'Quick search by member name, phone number or ID',
        'Manual override check-in for members with camera or phone issues',
      ]}
    />
  );
}

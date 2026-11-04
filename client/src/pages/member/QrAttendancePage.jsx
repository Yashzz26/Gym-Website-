import { QrCode } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function QrAttendancePage() {
  return (
    <PlaceholderScreen
      title="QR Attendance & Streak Tracker"
      screenNumber={2}
      role="Member"
      day="15 (Task 30)"
      icon={QrCode}
      description="Member attendance scanner powered by html5-qrcode. Scans rotating gym entrance QR code, submits token for atomic server validation, and tracks consecutive workout streaks."
      features={[
        'Live camera viewfinder via html5-qrcode for instant scanning',
        'Server-side QR validation against rotating 5-10 minute nonces',
        'Duplicate check-in prevention (one check-in per member per day)',
        'Streak counter, morning/evening session determination and celebratory feedback',
      ]}
    />
  );
}

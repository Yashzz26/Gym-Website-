import { BarChart3 } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function DailyReportPage() {
  return (
    <PlaceholderScreen
      title="Owner Analytics & Daily Report"
      role="Owner"
      icon={BarChart3}
      description="Executive overview of daily gym revenue, Cash vs UPI collection split, overdue unpaid dues, new enrollments, and weekly attendance visual graphs."
      features={[
        'Total daily revenue breakdown with Cash vs UPI payment methods',
        'Overdue dues tally and upcoming 7-day renewal projections',
        'Weekly attendance trend charts powered by Recharts',
        'New member conversions and trainer client allocations',
      ]}
    />
  );
}

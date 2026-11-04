import { Activity } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function WorkoutBuilderPage() {
  return (
    <PlaceholderScreen
      title="Workout Routine & Exercise Builder"
      role="Trainer"
      day="19 (Task 37)"
      icon={Activity}
      description="Exercise programming suite for gym trainers. Build day-split routines (Push/Pull/Legs, Upper/Lower), assign target sets and rep tempos, and sync with member apps."
      features={[
        'Day-split template library (Chest & Triceps, Back & Biceps, Legs, Core)',
        'Custom exercise creator with video link and instruction fields',
        'Bulk assignment to multiple members with similar training goals',
        'Member adherence tracking and progressive overload logs',
      ]}
    />
  );
}

import { Utensils } from 'lucide-react';
import PlaceholderScreen from '../../components/PlaceholderScreen';

export default function DietPlanPage() {
  return (
    <PlaceholderScreen
      title="Nutrition & Diet Plan Builder"
      screenNumber={8}
      role="Trainer"
      day="20 (Task 40)"
      icon={Utensils}
      description="Macronutrient and meal schedule creator for assigned members. Sets daily caloric targets, protein/carbs/fat ratios, and meal-by-meal food recommendations."
      features={[
        'Interactive macro calculator (Calories, Protein, Carbs, Fats in grams)',
        'Multi-meal scheduler (Breakfast, Lunch, Pre-workout, Post-workout, Dinner)',
        'Standard food item database with nutritional breakdowns',
        'One-click PDF / WhatsApp export to member',
      ]}
    />
  );
}

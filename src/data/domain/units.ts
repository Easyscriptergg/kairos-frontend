import { UnitSystem } from '../models/types';

// Records are always stored in metric; the unit preference only changes how they are displayed.
const KG_TO_LB = 2.20462;

export function weightUnit(unitSystem: UnitSystem): string {
  return unitSystem === 'imperial' ? 'lb' : 'kg';
}

export function convertWeight(kg: number, unitSystem: UnitSystem): number {
  const value = unitSystem === 'imperial' ? kg * KG_TO_LB : kg;
  return Math.round(value * 10) / 10;
}

export function formatWeight(kg: number, unitSystem: UnitSystem): string {
  return `${convertWeight(kg, unitSystem).toLocaleString('en-US')} ${weightUnit(unitSystem)}`;
}

/** Converts a weight typed in the display unit back to kilograms for storage. */
export function toKilograms(value: number, unitSystem: UnitSystem): number {
  return unitSystem === 'imperial' ? Math.round((value / KG_TO_LB) * 100) / 100 : value;
}

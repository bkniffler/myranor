import type { SpecialistTrait } from '../domain/types';

const TRAITS: Readonly<Record<number, SpecialistTrait>> = {
  1: {
    id: 1,
    name: 'Ambitioniert',
    positive: 'Zielstrebig',
    negative: 'Illoyal',
  },
  2: {
    id: 2,
    name: 'Akribisch',
    positive: 'Genau',
    negative: 'Übervorsichtig',
  },
  3: {
    id: 3,
    name: 'Diszipliniert',
    positive: 'Zuverlässig',
    negative: 'Pedanterie',
  },
  4: {
    id: 4,
    name: 'Charmant',
    positive: 'Überzeugend',
    negative: 'Manipulativ',
  },
  5: { id: 5, name: 'Kreativ', positive: 'Innovativ', negative: 'Sprunghaft' },
  6: { id: 6, name: 'Mutig', positive: 'Risikobereit', negative: 'Leichtsinn' },
  7: {
    id: 7,
    name: 'Analytisch',
    positive: 'Problemlösung',
    negative: 'Nervös',
  },
  8: { id: 8, name: 'Gelehrt', positive: 'Fachwissen', negative: 'Weltfremd' },
  9: {
    id: 9,
    name: 'Energisch',
    positive: 'Produktivität',
    negative: 'Ungeduldig',
  },
  10: {
    id: 10,
    name: 'Diplomat',
    positive: 'Vermittlung',
    negative: 'Unentschlossen',
  },
  11: {
    id: 11,
    name: 'Traditionell',
    positive: 'Erfahrung',
    negative: 'Verbohrt',
  },
  12: {
    id: 12,
    name: 'Ehrgeizig',
    positive: 'Motiviert',
    negative: 'Rücksichtslos',
  },
  13: {
    id: 13,
    name: 'Intuitiv',
    positive: 'Bauchgefühl',
    negative: 'Irrational',
  },
  14: {
    id: 14,
    name: 'Perfektionist',
    positive: 'Hervorragende Qualität',
    negative: 'Ineffizienz',
  },
  15: {
    id: 15,
    name: 'Autoritär',
    positive: 'Führungsstark',
    negative: 'Tyrann',
  },
  16: {
    id: 16,
    name: 'Pragmatisch',
    positive: 'Lösungsorientiert',
    negative: 'Prinzipienlos',
  },
  17: {
    id: 17,
    name: 'Stoisch',
    positive: 'Belastbar',
    negative: 'Emotionslos',
  },
  18: { id: 18, name: 'Ehrlich', positive: 'Loyal', negative: 'Beleidigend' },
  19: {
    id: 19,
    name: 'Emotional',
    positive: 'Sympathisch',
    negative: 'Nicht belastbar',
  },
  20: {
    id: 20,
    name: 'Religiös',
    positive: 'Schicksalergeben',
    negative: 'Fanatisch',
  },
} as const;

export function specialistTraitByRoll(rollTotal: number): SpecialistTrait {
  const id = Math.max(1, Math.min(20, Math.trunc(rollTotal)));
  return TRAITS[id] ?? TRAITS[1];
}

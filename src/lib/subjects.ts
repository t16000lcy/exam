import type { SubjectSlug } from '../types';

export interface SubjectInfo {
  slug: SubjectSlug;
  name: string;
  shortName: string;
  accent: string;
}

export const subjects: SubjectInfo[] = [
  {
    slug: 'clinical-physiology-pathology',
    name: '臨床生理學與病理學',
    shortName: '生理病理',
    accent: 'border-sea bg-teal-50',
  },
  {
    slug: 'hematology-blood-bank',
    name: '臨床血液學與血庫學',
    shortName: '血液血庫',
    accent: 'border-rose-700 bg-rose-50',
  },
  {
    slug: 'molecular-microscopy-parasitology',
    name: '醫學分子檢驗學與臨床鏡檢學（包括寄生蟲學）',
    shortName: '分子鏡檢',
    accent: 'border-indigo-700 bg-indigo-50',
  },
  {
    slug: 'microbiology-clinical-microbiology',
    name: '微生物學與臨床微生物學（包括細菌與黴菌）',
    shortName: '微生物',
    accent: 'border-amber-700 bg-amber-50',
  },
  {
    slug: 'biochemistry-clinical-biochemistry',
    name: '生物化學與臨床生化學',
    shortName: '生化',
    accent: 'border-leaf bg-lime-50',
  },
  {
    slug: 'serology-immunology-virology',
    name: '臨床血清免疫學與臨床病毒學',
    shortName: '血清免疫',
    accent: 'border-sky-700 bg-sky-50',
  },
];

export function getSubject(slug: SubjectSlug) {
  return subjects.find((subject) => subject.slug === slug);
}

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Map Tailwind bg classes to hex colors
const tailwindColorMap: Record<string, string> = {
  'bg-blue-500': '#3B82F6',
  'bg-blue-600': '#2563EB',
  'bg-green-500': '#22C55E',
  'bg-green-600': '#16A34A',
  'bg-purple-500': '#A855F7',
  'bg-purple-600': '#9333EA',
  'bg-amber-500': '#F59E0B',
  'bg-amber-600': '#D97706',
  'bg-red-500': '#EF4444',
  'bg-red-600': '#DC2626',
  'bg-cyan-500': '#06B6D4',
  'bg-cyan-600': '#0891B2',
  'bg-yellow-500': '#EAB308',
  'bg-orange-500': '#F97316',
  'bg-pink-500': '#EC4899',
  'bg-indigo-500': '#6366F1',
  'bg-teal-500': '#14B8A6',
  'bg-emerald-500': '#10B981',
  'bg-lime-500': '#84CC16',
  'bg-rose-500': '#F43F5E',
}

export function getColorFromClass(colorClass: string): string {
  // If it's already a hex color, return it
  if (colorClass.startsWith('#')) return colorClass
  return tailwindColorMap[colorClass] || '#9ACD32'
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

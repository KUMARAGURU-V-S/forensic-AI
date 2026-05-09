import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getRiskColor(level: string): string {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': return 'text-red-500 bg-red-500/10 border-red-500/30';
    case 'HIGH': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
    case 'MODERATE': return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    case 'LOW': return 'text-green-500 bg-green-500/10 border-green-500/30';
    default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
  }
}

export function getRiskGlow(level: string): string {
  switch (level?.toUpperCase()) {
    case 'CRITICAL': case 'HIGH': return 'risk-glow-high';
    case 'MODERATE': return 'risk-glow-moderate';
    case 'LOW': return 'risk-glow-low';
    default: return '';
  }
}

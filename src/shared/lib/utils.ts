import { clsx, twMerge, type ClassValue } from 'cn';

// Combine conditional classes and resolve conflicting Tailwind utilities.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs));
}

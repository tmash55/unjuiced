import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Unjuiced - Home',
};

export default function HomePage() {
  // Redirect /home to / for SEO and consistency
  // This ensures users clicking "Home" or the logo always land at the canonical URL
  redirect('/');
}


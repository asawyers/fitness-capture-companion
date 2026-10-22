import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
    title: 'Fitness Capture Companion', description: 'Private meal and workout notes, ready to review and log elsewhere.',
    icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body>{children}</body></html>; }

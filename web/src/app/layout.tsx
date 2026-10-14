import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Consulta de estado de cuenta · Oficina del Agua',
  description: 'Consulta el estado de cuenta de tu servicio de agua con el código de tu contador.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#04263D',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

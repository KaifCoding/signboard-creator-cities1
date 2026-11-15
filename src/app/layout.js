import './globals.css';

export const metadata = {
  title: 'Signboard / Flag Creator for Cities: Skylines',
  description: 'Design Indian-style signboards and flags, preview them in 3D and export genuine Cities: Skylines 1 .crp assets.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

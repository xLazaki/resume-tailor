import './globals.css';

export const metadata = {
  title: 'ปรับ CV ให้ตรงงาน',
  description: 'ตรวจ CV ฟรี และปรับให้ตรงกับตำแหน่งที่สมัครด้วย AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&family=Kanit:wght@400;500&family=Sarabun:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

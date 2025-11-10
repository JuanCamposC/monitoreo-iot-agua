'use client';

'use client';

import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "./contexts/AuthContext";
import { SidebarProvider, useSidebar } from "./contexts/SidebarContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/sidebar";
import SessionWarning from "./components/SessionWarning";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Componente para manejar el layout con margen dinámico
function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isOpen, isMobile } = useSidebar();

  const getMarginLeft = () => {
    if (isMobile) return '0px';
    return isOpen ? '256px' : '64px';
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main 
        className="flex-1 overflow-y-auto bg-gray-50 transition-all duration-300 ease-in-out"
        style={{ 
          marginLeft: getMarginLeft(),
          height: '100vh'
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <title>Sistema CIMARQ - Monitoreo IoT</title>
        <meta name="description" content="Sistema de Monitoreo de Sensores de Calidad del Agua" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ margin: 0, padding: 0 }}
      >
        <AuthProvider>
          <ProtectedRoute>
            <SidebarProvider>
              <LayoutContent>
                {children}
              </LayoutContent>
              <SessionWarning />
            </SidebarProvider>
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  );
}

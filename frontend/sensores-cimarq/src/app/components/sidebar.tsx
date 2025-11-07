"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { HiHome, HiChartBar, HiExclamation, HiCog, HiMenu, HiX, HiChevronDown, HiDownload } from "react-icons/hi";
import { FaThermometerHalf, FaTint, FaWind, FaPlay } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import { useSidebar } from "../contexts/SidebarContext";
import ProfileModal from "./ProfileModal";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  href?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { icon: <HiHome className="w-5 h-5" />, label: "Dashboard", href: "/" },
  {
    icon: <HiChartBar className="w-5 h-5" />,
    label: "Sensores",
    children: [
      { icon: <FaThermometerHalf className="w-4 h-4" />, label: "Temperatura", href: "/sensores/temperatura" },
      { icon: <FaTint className="w-4 h-4" />, label: "pH", href: "/sensores/ph" },
      { icon: <FaWind className="w-4 h-4" />, label: "Oxígeno", href: "/sensores/oxigeno" },
    ],
  },
  { icon: <HiCog className="w-4 h-4" />, label: "Ingreso Manual", href: "/sensores/ingreso-manual" },
  { icon: <FaPlay className="w-5 h-5" />, label: "Simulador", href: "/simulador" },
  { icon: <HiDownload className="w-5 h-5" />, label: "Exportar Datos", href: "/exportar-datos" },
  { icon: <HiExclamation className="w-5 h-5" />, label: "Alertas", href: "/alertas" },
  { icon: <HiCog className="w-5 h-5" />, label: "Configuración", href: "/configuracion" },
];

export default function Sidebar() {
  const { isOpen, isMobile, setIsOpen } = useSidebar();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Bloquea scroll cuando el sidebar móvil está abierto
  useEffect(() => {
    if (!isMobile) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = isOpen ? "hidden" : original || "";
    return () => {
      document.body.style.overflow = original || "";
    };
  }, [isOpen, isMobile]);

  // Cierra con ESC
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobile && isOpen) setIsOpen(false);
    },
    [isMobile, isOpen, setIsOpen]
  );
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  const toggleSidebar = () => setIsOpen(!isOpen);

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) => (prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]));
  };

  const handleLinkClick = () => {
    if (isMobile) setIsOpen(false);
  };

  return (
    <>
      {/* Botón móvil */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          aria-expanded={isOpen}
          aria-controls="mobile-sidebar"
          className="fixed top-4 left-4 z-[120] p-2 bg-slate-900 text-white rounded-lg shadow-lg lg:hidden"
        >
          {isOpen ? <HiX className="w-6 h-6" /> : <HiMenu className="w-6 h-6" />}
        </button>
      )}

      {/* CONTENEDOR SUPERIOR que crea su propio stacking context */}
      {/* Así evitamos que transform en padres afecte el z-index */}
      {isMobile && (
        <div className="lg:hidden fixed inset-0 z-[100] pointer-events-none">
          {/* Overlay */}
          {isOpen && (
            <div
              className="absolute inset-0 bg-black/50 z-[0] pointer-events-auto"
              onClick={() => setIsOpen(false)}
            />
          )}

          {/* Sidebar móvil */}
          <div
            id="mobile-sidebar"
            className={`absolute left-0 top-0 h-full w-64 z-[1] pointer-events-auto
                        bg-slate-900 text-white border-r border-slate-700
                        transition-transform duration-300 ease-in-out flex flex-col
                        ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            {/* --- CONTENIDO --- */}
            <Header isOpen onClose={!isMobile ? toggleSidebar : undefined} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Nav
                isOpen
                expandedItems={expandedItems}
                toggleExpanded={toggleExpanded}
                handleLinkClick={handleLinkClick}
              />
            </div>
            <Footer isOpen />
          </div>
        </div>
      )}

      {/* Sidebar desktop */}
      {!isMobile && (
        <div
          className={`fixed left-0 top-0 flex flex-col h-screen bg-slate-900 text-white z-50
                      transition-all duration-300 ease-in-out
                      ${isOpen ? "w-64" : "w-16"}
                      border-r border-slate-700 overflow-hidden`}
        >
          <Header isOpen={isOpen} onClose={!isMobile && isOpen ? toggleSidebar : undefined} onToggle={!isMobile && !isOpen ? toggleSidebar : undefined} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Nav
              isOpen={isOpen}
              expandedItems={expandedItems}
              toggleExpanded={toggleExpanded}
              handleLinkClick={handleLinkClick}
            />
          </div>
          <Footer isOpen={isOpen} />
        </div>
      )}
    </>
  );
}

/* --- Subcomponentes puros para mantener el JSX legible --- */

function Header({
  isOpen,
  onClose,
  onToggle,
}: {
  isOpen: boolean;
  onClose?: () => void;
  onToggle?: () => void;
}) {
  const { user } = useAuth();
  
  return (
    <div className="p-4 border-b border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          {isOpen && (
            <div>
              <h1 className="text-lg font-bold">CIMARQ</h1>
              <p className="text-xs text-slate-400">Monitor de Sensores</p>
            </div>
          )}
        </div>

        {onClose && isOpen && (
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded" aria-label="Cerrar sidebar">
            <HiX className="w-4 h-4" />
          </button>
        )}
      </div>

      {onToggle && !isOpen && (
        <button
          onClick={onToggle}
          className="mt-2 w-full p-2 hover:bg-slate-700 rounded flex justify-center"
          aria-label="Abrir sidebar"
        >
          <HiMenu className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

function Nav({
  isOpen,
  expandedItems,
  toggleExpanded,
  handleLinkClick,
}: {
  isOpen: boolean;
  expandedItems: string[];
  toggleExpanded: (label: string) => void;
  handleLinkClick: () => void;
}) {
  return (
    <nav className="flex-1 p-3 overflow-y-auto">
      <ul className="space-y-1">
        {menuItems.map((item) => (
          <li key={item.label}>
            {item.children ? (
              <div>
                <button
                  onClick={() => toggleExpanded(item.label)}
                  className={`w-full flex items-center p-3 rounded-lg hover:bg-slate-700 transition-colors ${
                    !isOpen ? "justify-center" : "justify-between"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {item.icon}
                    {isOpen && <span className="text-sm font-medium">{item.label}</span>}
                  </div>
                  {isOpen && (
                    <HiChevronDown
                      className={`w-4 h-4 transition-transform ${
                        expandedItems.includes(item.label) ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>

                {expandedItems.includes(item.label) && (
                  <ul
                    className={`mt-1 space-y-1 ${
                      isOpen ? "ml-6" : "ml-0 bg-slate-800 rounded-lg border-l-2 border-slate-600 pl-2"
                    }`}
                  >
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <Link
                          href={child.href!}
                          onClick={handleLinkClick}
                          className={`flex items-center p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-300 hover:text-white ${
                            isOpen ? "space-x-3" : "justify-center"
                          }`}
                        >
                          {child.icon}
                          {isOpen && <span className="text-sm">{child.label}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <Link
                href={item.href!}
                onClick={handleLinkClick}
                className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-700 transition-colors ${
                  !isOpen ? "justify-center" : ""
                }`}
              >
                {item.icon}
                {isOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Footer({ isOpen }: { isOpen: boolean }) {
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    setShowProfileMenu(false);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getRoleDisplay = (role: string) => {
    return role === 'admin' ? '👑 Administrador' : '👤 Usuario';
  };

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'bg-yellow-600' : 'bg-blue-600';
  };

  return (
    <>
      <div className="p-4 border-t border-slate-700">
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={`w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-700 transition-colors ${
              !isOpen ? "justify-center" : ""
            }`}
          >
            <div className={`w-8 h-8 ${getRoleColor(user.rol)} rounded-full flex items-center justify-center`}>
              <span className="text-white font-bold text-xs">
                {getInitials(user.nombre)}
              </span>
            </div>
            {isOpen && (
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {user.nombre}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {getRoleDisplay(user.rol)}
                </p>
              </div>
            )}
            {isOpen && (
              <HiChevronDown 
                className={`w-4 h-4 text-slate-400 transform transition-transform ${
                  showProfileMenu ? 'rotate-180' : ''
                }`} 
              />
            )}
          </button>

          {/* Menú desplegable del perfil */}
          {showProfileMenu && isOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50">
              <div className="p-2">
                <button
                  onClick={() => {
                    setShowProfileModal(true);
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center space-x-2 p-2 text-sm text-slate-200 hover:bg-slate-700 rounded-md transition-colors"
                >
                  <HiCog className="w-4 h-4" />
                  <span>Mi Perfil</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 p-2 text-sm text-red-400 hover:bg-slate-700 rounded-md transition-colors"
                >
                  <HiX className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Perfil */}
      {showProfileModal && (
        <ProfileModal 
          user={user}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  );
}

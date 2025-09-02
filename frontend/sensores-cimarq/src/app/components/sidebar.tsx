"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { HiHome, HiChartBar, HiExclamation, HiCog,HiMenu,HiX,HiChevronDown} from "react-icons/hi";
import { FaThermometerHalf, FaTint, FaWind } from "react-icons/fa";

interface MenuItem {
    icon: React.ReactNode;
    label: string;
    href?: string;
    children?: MenuItem[];
}

const menuItems: MenuItem[] = [
    {
        icon: <HiHome className="w-5 h-5" />,
        label: "Dashboard",
        href: "/"
    },
    {
        icon: <HiChartBar className="w-5 h-5" />,
        label: "Sensores",
        children: [
            {
                icon: <FaThermometerHalf className="w-4 h-4" />,
                label: "Temperatura",
                href: "/sensores/temperatura"
            },
            {
                icon: <FaTint className="w-4 h-4" />,
                label: "pH",
                href: "/sensores/ph"
            },
            {
                icon: <FaWind className="w-4 h-4" />,
                label: "Oxígeno",
                href: "/sensores/oxigeno"
            }
        ]
    },
    {
        icon: <HiExclamation className="w-5 h-5" />,
        label: "Alertas",
        href: "/alertas"
    },
    {
        icon: <HiCog className="w-5 h-5" />,
        label: "Configuración",
        href: "/configuracion"
    }
];

export default function Sidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [expandedItems, setExpandedItems] = useState<string[]>([]);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            
            if (!mobile) {
                setIsOpen(true);
            } else {
                setIsOpen(false);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    const toggleExpanded = (label: string) => {
        setExpandedItems(prev => 
            prev.includes(label) 
                ? prev.filter(item => item !== label)
                : [...prev, label]
        );
    };

    const handleLinkClick = () => {
        if (isMobile) {
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Mobile menu button */}
            {isMobile && (
                <button
                    onClick={toggleSidebar}
                    className="fixed top-4 left-4 z-50 p-2 bg-slate-900 text-white rounded-lg shadow-lg lg:hidden"
                >
                    {isOpen ? <HiX className="w-6 h-6" /> : <HiMenu className="w-6 h-6" />}
                </button>
            )}

            {/* Overlay */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
                    ${isMobile ? 'fixed' : 'relative'}
                    left-0 top-0 h-full z-45 bg-slate-900 text-white
                    transition-all duration-300 ease-in-out
                    ${isMobile 
                        ? (isOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full')
                        : (isOpen ? 'w-64' : 'w-16')
                    }
                    border-r border-slate-700 overflow-hidden
                `}
            >
                {/* Header */}
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
                        
                        {!isMobile && isOpen && (
                            <button
                                onClick={toggleSidebar}
                                className="p-1 hover:bg-slate-700 rounded"
                            >
                                <HiX className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    
                    {!isMobile && !isOpen && (
                        <button
                            onClick={toggleSidebar}
                            className="mt-2 w-full p-2 hover:bg-slate-700 rounded flex justify-center"
                        >
                            <HiMenu className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3">
                    <ul className="space-y-1">
                        {menuItems.map((item) => (
                            <li key={item.label}>
                                {item.children ? (
                                    <div>
                                        <button
                                            onClick={() => toggleExpanded(item.label)}
                                            className={`
                                                w-full flex items-center justify-between p-3 rounded-lg
                                                hover:bg-slate-700 transition-colors
                                                ${!isOpen ? 'justify-center' : ''}
                                            `}
                                        >
                                            <div className="flex items-center space-x-3">
                                                {item.icon}
                                                {isOpen && <span className="text-sm font-medium">{item.label}</span>}
                                            </div>
                                            {isOpen && (
                                                <HiChevronDown
                                                    className={`w-4 h-4 transition-transform ${
                                                        expandedItems.includes(item.label) ? 'rotate-180' : ''
                                                    }`}
                                                />
                                            )}
                                        </button>
                                        
                                        {isOpen && expandedItems.includes(item.label) && (
                                            <ul className="mt-1 ml-6 space-y-1">
                                                {item.children.map((child) => (
                                                    <li key={child.label}>
                                                        <Link
                                                            href={child.href!}
                                                            onClick={handleLinkClick}
                                                            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-300 hover:text-white"
                                                        >
                                                            {child.icon}
                                                            <span className="text-sm">{child.label}</span>
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
                                        className={`
                                            flex items-center space-x-3 p-3 rounded-lg
                                            hover:bg-slate-700 transition-colors
                                            ${!isOpen ? 'justify-center' : ''}
                                        `}
                                    >
                                        {item.icon}
                                        {isOpen && <span className="text-sm font-medium">{item.label}</span>}
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700">
                    <div className={`flex items-center space-x-3 ${!isOpen ? 'justify-center' : ''}`}>
                        <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold">A</span>
                        </div>
                        {isOpen && (
                            <div>
                                <p className="text-sm font-medium">Admin</p>
                                <p className="text-xs text-slate-400">En línea</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
'use client';

import { useEffect } from 'react';
import { useNombreSistema } from '../hooks/useNombreSistema';

interface DynamicTitleProps {
  pageName?: string;
}

export default function DynamicTitle({ pageName }: DynamicTitleProps) {
  const nombreSistema = useNombreSistema();

  useEffect(() => {
    const titulo = pageName ? `${pageName} - ${nombreSistema}` : nombreSistema;
    document.title = titulo;
  }, [nombreSistema, pageName]);

  return null; // Este componente no renderiza nada visible
}
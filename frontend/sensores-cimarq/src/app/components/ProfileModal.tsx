"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { HiX, HiUser, HiLockClosed } from "react-icons/hi";
import { useAuth } from "../contexts/AuthContext";

interface User {
  email: string;
  nombre: string;
  rol: string;
}

interface ProfileModalProps {
  user: User;
  onClose: () => void;
}

export default function ProfileModal({ user, onClose }: ProfileModalProps) {
  const { updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nombre: user.nombre,
    email: user.email,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Sincronizar formData con los datos actualizados del usuario
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      nombre: user.nombre,
      email: user.email
    }));
  }, [user.nombre, user.email]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Validaciones
      if (!formData.nombre.trim()) {
        throw new Error('El nombre no puede estar vacío');
      }

      if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
        throw new Error('Las contraseñas no coinciden');
      }

      if (formData.newPassword && !formData.currentPassword) {
        throw new Error('Debes ingresar tu contraseña actual para cambiarla');
      }

      if (formData.newPassword && formData.newPassword.length < 6) {
        throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
      }

      // Preparar datos para enviar
      const updateData: {
        nombre: string;
        email: string;
        currentPassword?: string;
        newPassword?: string;
      } = {
        nombre: formData.nombre.trim(),
        email: formData.email.trim()
      };

      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      console.log('Datos a enviar desde ProfileModal:', updateData);

      // Usar la función del contexto
      const result = await updateProfile(updateData);

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Perfil actualizado correctamente' });
        setIsEditing(false);
        
        // Limpiar campos de contraseña
        setFormData({
          ...formData,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        throw new Error(result.message || 'Error al actualizar perfil');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      nombre: user.nombre,
      email: user.email,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setIsEditing(false);
    setMessage({ type: '', text: '' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getRoleDisplay = (role: string) => {
    return role === 'admin' ? 'Administrador' : 'Usuario';
  };

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'bg-yellow-600' : 'bg-blue-600';
  };

  // Función removida: ya no hay overlay para hacer clic

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Cerrar modal con ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const modalContent = (
    <>
      {/* Backdrop con solo desenfoque */}
      <div className="fixed inset-0 backdrop-blur-sm z-[99998]" />
      
      {/* Modal Content */}
      <div 
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[99999] p-4"
        style={{ zIndex: 99999 }}
      >
        <div className="bg-slate-800 rounded-lg w-150 max-h-[90vh] overflow-y-auto border border-slate-600" 
           style={{ 
             boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
           }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <HiUser className="w-5 h-5" />
            <span>Mi Perfil</span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-700"
          >
            <HiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Avatar y información del usuario */}
          <div className="flex items-center space-x-4 mb-6">
            <div className={`w-16 h-16 ${getRoleColor(user.rol)} rounded-full flex items-center justify-center shadow-lg`}>
              <span className="text-white font-bold text-xl">
                {getInitials(user.nombre)}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{user.nombre}</h3>
              <p className="text-slate-400 text-sm">
                {getRoleDisplay(user.rol)}
              </p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </div>

          {/* Mensaje de estado */}
          {message.text && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-900 text-green-200 border border-green-700' 
                : 'bg-red-900 text-red-200 border border-red-700'
            }`}>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  message.type === 'success' ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
                <span className="text-sm">{message.text}</span>
              </div>
            </div>
          )}

          {/* Formulario */}
          <div className="space-y-4">
            {/* Información de la cuenta */}
            <div className="bg-slate-700 bg-opacity-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-slate-300 mb-3">
                Información de la cuenta
              </h4>
              
              {/* Nombre */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombre de Usuario
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={!isEditing}
                  className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                />
              </div>
            </div>

            {/* Sección de cambio de contraseña */}
            {isEditing && (
              <div className="bg-slate-700 bg-opacity-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center space-x-2">
                  <HiLockClosed className="w-4 h-4" />
                  <span>Cambiar Contraseña (opcional)</span>
                </h4>

                <div className="mt-1 mb-3 p-3 bg-blue-900 bg-opacity-30 border border-blue-700 border-opacity-50 rounded-lg">
                  <p className="text-xs text-blue-200">
                    💡 Deja estos campos vacíos si no quieres cambiar tu contraseña
                  </p>
                </div>                
                
                <div className="space-y-3">
                  <input
                    type="password"
                    name="currentPassword"
                    placeholder="Contraseña actual"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                  />
                  <input
                    type="password"
                    name="newPassword"
                    placeholder="Nueva contraseña (mínimo 6 caracteres)"
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                  />
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirmar nueva contraseña"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-700">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <HiUser className="w-4 h-4" />
                <span>Editar Perfil</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {loading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </>
            )}
          </div>
        </div>
        </div>
      </div>
    </>
  );

  // Renderizar el modal usando un portal en el body
  if (typeof window === 'undefined') {
    return null;
  }

  return createPortal(modalContent, document.body);
}
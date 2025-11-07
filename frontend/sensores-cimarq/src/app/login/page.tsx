'use client';

import React, { useState } from 'react';
import {Box,CardContent,TextField,Button,Typography,Alert,CircularProgress,Container,Paper,Divider,InputAdornment,IconButton} from '@mui/material';
import {MdEmail,MdLock,MdVisibility,MdVisibilityOff,MdLogin,MdPersonAdd,MdSecurity} from 'react-icons/md';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nombre: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        const result = await login(formData.email, formData.password);
        if (!result.success) {
          setError(result.message || 'Error en el inicio de sesión');
        }
      } else {
        // Validaciones para registro
        if (formData.password !== formData.confirmPassword) {
          setError('Las contraseñas no coinciden');
          setLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres');
          setLoading(false);
          return;
        }

        const result = await register({
          email: formData.email,
          password: formData.password,
          nombre: formData.nombre,
          confirmPassword: formData.confirmPassword
        });

        if (result.success) {
          setSuccess('Usuario registrado exitosamente. Ahora puedes iniciar sesión.');
          setMode('login');
          setFormData({ email: formData.email, password: '', nombre: '', confirmPassword: '' });
        } else {
          setError(result.message || 'Error en el registro');
        }
      }
    } catch {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    setError('');
    setSuccess('');
  };

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4 }}>
      <Paper 
        elevation={8} 
        sx={{ 
          width: '100%', 
          background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
          borderRadius: 3,
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <Box 
          sx={{ 
            bgcolor: 'primary.main', 
            color: 'white', 
            p: 4, 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
          }}
        >
          <MdSecurity size={48} style={{ marginBottom: '16px' }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Sistema CIMARQ
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>
            Monitoreo IoT de Calidad del Agua
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 'bold', color: 'text.primary' }}>
              {mode === 'login' ? '🔐 Iniciar Sesión' : '👤 Registro de Administrador'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mode === 'login' 
                ? 'Ingresa tus credenciales para acceder al sistema' 
                : 'Crea la cuenta de administrador del sistema'
              }
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {success}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {mode === 'register' && (
                <TextField
                  fullWidth
                  label="Nombre Completo"
                  variant="outlined"
                  value={formData.nombre}
                  onChange={handleInputChange('nombre')}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MdPersonAdd color="#1976d2" />
                      </InputAdornment>
                    ),
                  }}
                />
              )}

              <TextField
                fullWidth
                label="Correo Electrónico"
                type="email"
                variant="outlined"
                value={formData.email}
                onChange={handleInputChange('email')}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MdEmail color="#1976d2" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                value={formData.password}
                onChange={handleInputChange('password')}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MdLock color="#1976d2" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {mode === 'register' && (
                <TextField
                  fullWidth
                  label="Confirmar Contraseña"
                  type={showConfirmPassword ? 'text' : 'password'}
                  variant="outlined"
                  value={formData.confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MdLock color="#1976d2" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <MdVisibilityOff /> : <MdVisibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : (mode === 'login' ? <MdLogin /> : <MdPersonAdd />)}
                sx={{ 
                  py: 1.5, 
                  fontSize: '1.1rem',
                  background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                  }
                }}
              >
                {loading 
                  ? 'Procesando...' 
                  : mode === 'login' 
                    ? 'Iniciar Sesión' 
                    : 'Crear Cuenta de Administrador'
                }
              </Button>
            </Box>
          </form>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {mode === 'login' 
                ? '¿No tienes una cuenta de administrador?' 
                : '¿Ya tienes una cuenta?'
              }
            </Typography>
            <Button
              variant="text"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
                setSuccess('');
                setFormData({ email: '', password: '', nombre: '', confirmPassword: '' });
              }}
              sx={{ fontWeight: 'bold' }}
            >
              {mode === 'login' ? 'Crear Cuenta de Administrador' : 'Volver al Inicio de Sesión'}
            </Button>
          </Box>

          {mode === 'register' && (
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2">
                <strong>Nota:</strong> Esta es la cuenta principal del sistema. Solo debe ser creada una vez por el administrador del sistema.
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Paper>
    </Container>
  );
}
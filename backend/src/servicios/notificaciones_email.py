"""
Servicio de Notificaciones por Email para Sistema CIMARQ
Maneja el envío automático de alertas criticas por correo electrónico
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
import pytz
from typing import List, Dict, Any, Optional
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Timezone Chile
CHILE_TZ = pytz.timezone('America/Santiago')

class ServicioNotificacionesEmail:
    """Servicio para envío de notificaciones por email"""
    
    def __init__(self):
        # Configuración SMTP
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.email_remitente = os.getenv("EMAIL_REMITENTE", "alertas.cimarq@gmail.com")
        self.email_password = os.getenv("EMAIL_PASSWORD", "")
        
        # Lista de destinatarios por defecto
        self.destinatarios_default = [
            os.getenv("EMAIL_OPERADOR", "operador@cimarq.com"),
            os.getenv("EMAIL_SUPERVISOR", "supervisor@cimarq.com")
        ]
        
        # Configuración de alertas
        self.niveles_notificacion = {
            'CRITICO': True,    # Siempre notificar
            'ALTO': False,       # Notificar si está habilitado
            'MEDIO': False,     # No notificar por email
            'BAJO': False       # No notificar por email
        }
        
        # Base de datos (será asignada desde app.py)
        self.db = None
    
    def set_database(self, db):
        """Establece la conexión a la base de datos"""
        self.db = db
    
    def verificar_emails_habilitados(self) -> bool:
        """Verifica si los emails están habilitados en la configuración de la base de datos"""
        if self.db is None:
            return True  # Por defecto habilitado si no hay BD
        
        try:
            config_doc = self.db.configuracion.find_one({'tipo': 'emails'})
            return config_doc.get('habilitado', True) if config_doc else True
        except Exception as e:
            logger.error(f"Error verificando configuración de emails: {e}")
            return True  # Por defecto habilitado en caso de error
    
    def verificar_configuracion(self) -> bool:
        """Verifica si la configuración de email está completa"""
        return bool(
            self.email_remitente and 
            self.email_password and 
            self.smtp_server
        )
    
    def generar_plantilla_alerta_critica(self, alerta_data: Dict[str, Any]) -> str:
        """Genera el contenido HTML para alertas criticas"""
        
        fecha_chile = datetime.now(CHILE_TZ).strftime("%d/%m/%Y %H:%M:%S")
        
        # Detectar si es una alerta agrupada (múltiples sensores)
        sensor_nombre = alerta_data.get('sensor', 'sensor')
        mensaje_alerta = alerta_data.get('mensaje', '')
        logger.info(f"📧 Generando email para sensor: '{sensor_nombre}'")
        logger.info(f"📄 Mensaje: {mensaje_alerta[:150]}...")
        es_alerta_agrupada = 'sensores' in sensor_nombre.lower() and 'criticos' in sensor_nombre.lower()
        logger.info(f"¿Es alerta agrupada? {es_alerta_agrupada} (buscando 'sensores' y 'criticos' en '{sensor_nombre.lower()}')")
        
        # Color por nivel
        nivel_color = {
            'CRITICO': '#d32f2f',
            'ALTO': '#f57c00',
            'MEDIO': '#1976d2',
            'BAJO': '#388e3c'
        }
        
        color = nivel_color.get(alerta_data.get('nivel', 'MEDIO'), '#1976d2')
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>CIMARQ - Alerta {alerta_data.get('nivel', 'CRITICA')}</title>
        </head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="background: {color}; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">
                        {'🚨 ALERTA CRITICA MÚLTIPLE' if es_alerta_agrupada else f'SISTEMA CIMARQ - ALERTA {alerta_data.get("nivel", "CRITICA")}'}
                    </h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">
                        Sistema de Monitoreo Acuícola Preventivo
                    </p>
                </div>
                
                <!-- Información Principal -->
                <div style="padding: 30px;">
        """
        
        # Contenido diferente para alertas agrupadas
        if es_alerta_agrupada:
            # Extraer información de sensores del mensaje
            mensaje = alerta_data.get('mensaje', '')
            logger.info(f"📝 Mensaje recibido: {mensaje[:200]}...")  # Primeros 200 caracteres
            cantidad_sensores = alerta_data.get('valor_actual', 0)
            
            # Parsear sensores del mensaje (formato: "TEMPERATURA: 35°C\nPH: 5.2\nOXIGENO: 3.5 mg/L")
            lineas_mensaje = mensaje.split('\n')
            sensores_info = []
            
            for linea in lineas_mensaje:
                linea = linea.strip()
                if ':' in linea and any(s in linea.upper() for s in ['TEMPERATURA', 'PH', 'OXIGENO', 'OXÍGENO']):
                    sensores_info.append(linea)
            
            html_content += f"""
                    <div style="background: #ffebee; border-left: 4px solid {color}; padding: 20px; margin-bottom: 20px;">
                        <h2 style="margin: 0 0 15px 0; color: {color}; font-size: 20px;">
                            ⚠️ {cantidad_sensores} PARÁMETROS FUERA DE RANGO SEGURO
                        </h2>
                        <p style="margin: 0; font-size: 16px; line-height: 1.5; color: #c62828;">
                            <strong>Se han detectado múltiples parámetros criticos que requieren atención inmediata.</strong>
                        </p>
                    </div>
                    
                    <!-- Tabla de Sensores Criticos -->
                    <div style="margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">
                            Parámetros Afectados:
                        </h3>
                        <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                            <thead>
                                <tr style="background: {color}; color: white;">
                                    <th style="padding: 12px; text-align: left; border: 1px solid {color};">Parámetro</th>
                                    <th style="padding: 12px; text-align: center; border: 1px solid {color};">Valor Actual</th>
                                    <th style="padding: 12px; text-align: center; border: 1px solid {color};">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
            """
            
            # Agregar filas para cada sensor
            for sensor_linea in sensores_info:
                if ':' in sensor_linea:
                    sensor_nombre, valor = sensor_linea.split(':', 1)
                    sensor_nombre = sensor_nombre.strip()
                    valor = valor.strip()
                    
                    # Determinar ícono y color por sensor
                    if 'TEMPERATURA' in sensor_nombre:
                        icono = '🌡️'
                        sensor_display = 'Temperatura'
                    elif 'PH' in sensor_nombre:
                        icono = '🧪'
                        sensor_display = 'pH'
                    elif 'OXIGENO' in sensor_nombre or 'OXÍGENO' in sensor_nombre:
                        icono = '💨'
                        sensor_display = 'Oxígeno Disuelto'
                    else:
                        icono = '📊'
                        sensor_display = sensor_nombre
                    
                    html_content += f"""
                                <tr style="background: #fff3e0;">
                                    <td style="padding: 12px; border: 1px solid #e0e0e0;">
                                        <strong>{icono} {sensor_display}</strong>
                                    </td>
                                    <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">
                                        <span style="color: {color}; font-size: 18px; font-weight: bold;">{valor}</span>
                                    </td>
                                    <td style="padding: 12px; border: 1px solid #e0e0e0; text-align: center;">
                                        <span style="background: {color}; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 12px;">
                                            CRITICO
                                        </span>
                                    </td>
                                </tr>
                    """
            
            html_content += """
                            </tbody>
                        </table>
                    </div>
                    
                    <!-- Información Adicional -->
                    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">
                            ⚠️ Advertencia:
                        </h3>
                        <p style="margin: 0; color: #856404; line-height: 1.6;">
                            Los valores actuales se encuentran <strong>fuera de los rangos seguros</strong> establecidos 
                            para las condiciones acuícolas óptimas. Esta situación puede comprometer la salud de los 
                            organismos acuáticos y afectar la calidad del agua.
                        </p>
                    </div>
            """
        else:
            # Plantilla para sensor individual (código original)
            html_content += f"""
                    <div style="background: #f8f9fa; border-left: 4px solid {color}; padding: 20px; margin-bottom: 20px;">
                        <h2 style="margin: 0 0 15px 0; color: {color}; font-size: 20px;">
                            {sensor_nombre.upper()}
                        </h2>
                        <p style="margin: 0; font-size: 16px; line-height: 1.5; color: #333;">
                            <strong>{alerta_data.get('mensaje', 'Sin mensaje')}</strong>
                        </p>
                    </div>
                    
                    <!-- Detalles -->
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e0e0e0; background: #fafafa; font-weight: bold; width: 30%;">
                                Valor Actual:
                            </td>
                            <td style="padding: 12px; border: 1px solid #e0e0e0;">
                                <strong style="color: {color}; font-size: 18px;">
                                    {alerta_data.get('valor_actual', 'N/A')}
                                    {self._obtener_unidad_sensor(alerta_data.get('sensor', ''))}
                                </strong>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e0e0e0; background: #fafafa; font-weight: bold;">
                                Nivel de Alerta:
                            </td>
                            <td style="padding: 12px; border: 1px solid #e0e0e0;">
                                <span style="background: {color}; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">
                                    {alerta_data.get('nivel', 'MEDIO')}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e0e0e0; background: #fafafa; font-weight: bold;">
                                Fecha Detección:
                            </td>
                            <td style="padding: 12px; border: 1px solid #e0e0e0;">
                                {alerta_data.get('fecha_creacion', fecha_chile)}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e0e0e0; background: #fafafa; font-weight: bold;">
                                Prioridad:
                            </td>
                            <td style="padding: 12px; border: 1px solid #e0e0e0;">
                                {alerta_data.get('prioridad', 3)}/5
                            </td>
                        </tr>
                    </table>
            """
        
        # Detalles de fecha (común para ambos tipos)
        html_content += f"""
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e0e0e0; background: #fafafa; font-weight: bold; width: 30%;">
                                Fecha Detección:
                            </td>
                            <td style="padding: 12px; border: 1px solid #e0e0e0;">
                                {alerta_data.get('fecha_creacion', fecha_chile)}
                            </td>
                        </tr>
                    </table>
        """
        
        # Agregar sugerencias si existen
        sugerencias = alerta_data.get('sugerencias', [])
        if sugerencias:
            html_content += f"""
                    <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 6px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #2e7d32; font-size: 16px;">
                            Acciones Recomendadas:
                        </h3>
                        <ul style="margin: 0; padding-left: 20px; color: #2e7d32;">
            """
            for sugerencia in sugerencias:
                html_content += f"<li style='margin-bottom: 8px;'>{sugerencia}</li>"
            
            html_content += """
                        </ul>
                    </div>
            """
        
        # Footer
        html_content += f"""
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                        <a href="http://localhost:3000/alertas" 
                           style="display: inline-block; background: {color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 15px;">
                            Acceder al Dashboard
                        </a>
                        <p style="margin: 0; color: #666; font-size: 12px;">
                            Sistema CIMARQ - Monitoreo Acuícola Inteligente<br>
                            Generado automáticamente el {fecha_chile}
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html_content
    
    def _obtener_unidad_sensor(self, sensor: str) -> str:
        """Obtiene la unidad de medida para cada sensor"""
        unidades = {
            'temperatura': ' °C',
            'ph': '',
            'oxigeno': ' mg/L'
        }
        return unidades.get(sensor.lower(), '')
    
    def enviar_alerta_email(
        self, 
        alerta_data: Dict[str, Any], 
        destinatarios: Optional[List[str]] = None
    ) -> bool:
        """
        Envía una alerta por email
        
        Args:
            alerta_data: Datos de la alerta
            destinatarios: Lista de emails destinatarios (opcional)
        
        Returns:
            bool: True si se envió correctamente
        """
        
        if not self.verificar_configuracion():
            logger.error("Configuración de email incompleta")
            return False
        
        # Verificar configuración global de emails (aplica a alertas automáticas y predictivas)
        if not self.verificar_emails_habilitados():
            logger.info("Emails deshabilitados globalmente por configuración del usuario")
            return True  # No es error, simplemente está desactivado
        
        # Verificar si debe notificar este nivel
        nivel = alerta_data.get('nivel', 'MEDIO')
        if not self.niveles_notificacion.get(nivel, False):
            logger.info(f"Nivel {nivel} no configurado para notificación por email")
            return True  # No es error, simplemente no se envía
        
        # Usar destinatarios por defecto si no se proporcionan
        if not destinatarios:
            destinatarios = self.destinatarios_default
        
        try:
            # Crear mensaje
            msg = MIMEMultipart('alternative')
            sensor = alerta_data.get('sensor', 'sensor').upper()
            nivel = alerta_data.get('nivel', 'ALERTA')
            
            msg['From'] = self.email_remitente
            msg['To'] = ", ".join(destinatarios)
            msg['Subject'] = f"CIMARQ - {nivel} {sensor}: Acción Requerida"
            
            # Contenido HTML
            html_content = self.generar_plantilla_alerta_critica(alerta_data)
            html_part = MIMEText(html_content, 'html', 'utf-8')
            
            # Contenido texto plano como fallback
            text_content = self._generar_texto_plano(alerta_data)
            text_part = MIMEText(text_content, 'plain', 'utf-8')
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Enviar email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.email_remitente, self.email_password)
            
            text = msg.as_string()
            server.sendmail(self.email_remitente, destinatarios, text)
            server.quit()
            
            logger.info(f"Email enviado exitosamente a {len(destinatarios)} destinatarios")
            return True
            
        except Exception as e:
            logger.error(f"Error enviando email: {str(e)}")
            return False
    
    def _generar_texto_plano(self, alerta_data: Dict[str, Any]) -> str:
        """Genera versión texto plano del email"""
        
        texto = f"""
SISTEMA CIMARQ - ALERTA {alerta_data.get('nivel', 'CRITICA')}

Sensor: {alerta_data.get('sensor', 'Desconocido').upper()}
Nivel: {alerta_data.get('nivel', 'MEDIO')}
Mensaje: {alerta_data.get('mensaje', 'Sin mensaje')}
Valor Actual: {alerta_data.get('valor_actual', 'N/A')}{self._obtener_unidad_sensor(alerta_data.get('sensor', ''))}
Fecha: {alerta_data.get('fecha_creacion', 'N/A')}
Prioridad: {alerta_data.get('prioridad', 3)}/5

"""
        
        # Agregar sugerencias
        sugerencias = alerta_data.get('sugerencias', [])
        if sugerencias:
            texto += "ACCIONES RECOMENDADAS:\n"
            for i, sugerencia in enumerate(sugerencias, 1):
                texto += f"{i}. {sugerencia}\n"
            texto += "\n"
        
        texto += """
Acceder al Dashboard: http://localhost:3000/alertas

---
Sistema CIMARQ - Monitoreo Acuícola Inteligente
Generado automáticamente
"""
        
        return texto
    


    def enviar_email_con_adjunto(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Envía email con archivo adjunto
        
        Args:
            email_data: Dict con 'destinatario', 'asunto', 'mensaje', 'archivo_adjunto'
            archivo_adjunto: Dict con 'contenido', 'nombre', 'tipo_mime'
        """
        try:
            if not self.verificar_configuracion():
                return {
                    'success': False,
                    'error': 'Configuración de email incompleta'
                }

            # Crear mensaje
            msg = MIMEMultipart()
            msg['From'] = self.email_remitente
            msg['To'] = email_data['destinatario']
            msg['Subject'] = email_data['asunto']

            # Agregar cuerpo del mensaje
            msg.attach(MIMEText(email_data['mensaje'], 'plain', 'utf-8'))

            # Agregar archivo adjunto si existe
            if 'archivo_adjunto' in email_data:
                adjunto = email_data['archivo_adjunto']
                
                # Crear parte del adjunto
                part = MIMEBase('application', 'octet-stream')
                
                # Manejar contenido según tipo
                contenido = adjunto['contenido']
                if isinstance(contenido, str):
                    # CSV o texto
                    part.set_payload(contenido.encode('utf-8-sig'))
                else:
                    # Excel binario
                    part.set_payload(contenido)
                
                # Codificar en base64
                encoders.encode_base64(part)
                
                # Agregar headers del adjunto
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename= {adjunto["nombre"]}'
                )
                
                # Agregar tipo MIME si se especifica
                if 'tipo_mime' in adjunto:
                    part.add_header('Content-Type', adjunto['tipo_mime'])
                
                msg.attach(part)

            # Enviar email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.email_remitente, self.email_password)
                server.send_message(msg)

            logger.info(f"Email con adjunto enviado a: {email_data['destinatario']}")
            
            return {
                'success': True,
                'mensaje': f'Email enviado exitosamente a {email_data["destinatario"]}',
                'timestamp': datetime.now(CHILE_TZ).isoformat()
            }

        except Exception as e:
            error_msg = f"Error enviando email con adjunto: {str(e)}"
            logger.error(f"{error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'timestamp': datetime.now(CHILE_TZ).isoformat()
            }




# Instancia global del servicio
servicio_email = ServicioNotificacionesEmail()
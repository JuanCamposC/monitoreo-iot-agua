"""
Servicio de Notificaciones por Email para Sistema CIMARQ
Maneja el envío automático de alertas críticas por correo electrónico
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
            'ALTO': True,       # Notificar si está habilitado
            'MEDIO': False,     # No notificar por email
            'BAJO': False       # No notificar por email
        }
    
    def verificar_configuracion(self) -> bool:
        """Verifica si la configuración de email está completa"""
        return bool(
            self.email_remitente and 
            self.email_password and 
            self.smtp_server
        )
    
    def generar_plantilla_alerta_critica(self, alerta_data: Dict[str, Any]) -> str:
        """Genera el contenido HTML para alertas críticas"""
        
        fecha_chile = datetime.now(CHILE_TZ).strftime("%d/%m/%Y %H:%M:%S")
        
        # Emoji por sensor
        sensor_emoji = {
            'temperatura': '🌡️',
            'ph': '🧪', 
            'oxigeno': '💨'
        }
        
        # Color por nivel
        nivel_color = {
            'CRITICO': '#d32f2f',
            'ALTO': '#f57c00',
            'MEDIO': '#1976d2',
            'BAJO': '#388e3c'
        }
        
        emoji = sensor_emoji.get(alerta_data.get('sensor', ''), '⚠️')
        color = nivel_color.get(alerta_data.get('nivel', 'MEDIO'), '#1976d2')
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>CIMARQ - Alerta {alerta_data.get('nivel', 'CRÍTICA')}</title>
        </head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <div style="background: {color}; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">
                        🚨 SISTEMA CIMARQ - ALERTA {alerta_data.get('nivel', 'CRÍTICA')}
                    </h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">
                        Sistema de Monitoreo Acuícola Preventivo
                    </p>
                </div>
                
                <!-- Información Principal -->
                <div style="padding: 30px;">
                    <div style="background: #f8f9fa; border-left: 4px solid {color}; padding: 20px; margin-bottom: 20px;">
                        <h2 style="margin: 0 0 15px 0; color: {color}; font-size: 20px;">
                            {emoji} {alerta_data.get('sensor', 'Sensor').upper()}
                        </h2>
                        <p style="margin: 0; font-size: 16px; line-height: 1.5; color: #333;">
                            <strong>{alerta_data.get('mensaje', 'Sin mensaje')}</strong>
                        </p>
                    </div>
                    
                    <!-- Detalles -->
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e0e0e0; background: #fafafa; font-weight: bold; width: 30%;">
                                📊 Valor Actual:
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
                                🔴 Nivel de Alerta:
                            </td>
                            <td style="padding: 12px; border: 1px solid #e0e0e0;">
                                <span style="background: {color}; color: white; padding: 4px 12px; border-radius: 4px; font-weight: bold;">
                                    {alerta_data.get('nivel', 'MEDIO')}
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e0e0e0; background: #fafafa; font-weight: bold;">
                                ⏰ Fecha Detección:
                            </td>
                            <td style="padding: 12px; border: 1px solid #e0e0e0;">
                                {alerta_data.get('fecha_creacion', fecha_chile)}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #e0e0e0; background: #fafafa; font-weight: bold;">
                                🎯 Prioridad:
                            </td>
                            <td style="padding: 12px; border: 1px solid #e0e0e0;">
                                {alerta_data.get('prioridad', 3)}/5
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
                            💡 Acciones Recomendadas:
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
                            🌐 Acceder al Dashboard
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
            msg['Subject'] = f"🚨 CIMARQ - {nivel} {sensor}: Acción Requerida"
            
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
SISTEMA CIMARQ - ALERTA {alerta_data.get('nivel', 'CRÍTICA')}

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
    
    def probar_configuracion(self) -> Dict[str, Any]:
        """
        Prueba la configuración de email enviando un mensaje de test
        
        Returns:
            dict: Resultado de la prueba
        """
        
        if not self.verificar_configuracion():
            return {
                'success': False,
                'error': 'Configuración incompleta',
                'detalles': {
                    'smtp_server': bool(self.smtp_server),
                    'email_remitente': bool(self.email_remitente),
                    'email_password': bool(self.email_password)
                }
            }
        
        # Datos de prueba
        alerta_prueba = {
            'sensor': 'temperatura',
            'nivel': 'CRITICO',
            'mensaje': '🧪 Mensaje de prueba del sistema de notificaciones CIMARQ',
            'valor_actual': 25.5,
            'fecha_creacion': datetime.now(CHILE_TZ).strftime("%d/%m/%Y %H:%M:%S"),
            'prioridad': 5,
            'sugerencias': [
                'Este es un email de prueba del sistema',
                'Si recibe este mensaje, la configuración es correcta',
                'Puede proceder con el monitoreo automático'
            ]
        }
        
        try:
            exito = self.enviar_alerta_email(alerta_prueba)
            return {
                'success': exito,
                'mensaje': 'Email de prueba enviado exitosamente' if exito else 'Error al enviar email de prueba',
                'destinatarios': self.destinatarios_default,
                'timestamp': datetime.now(CHILE_TZ).isoformat()
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now(CHILE_TZ).isoformat()
            }


# Instancia global del servicio
servicio_email = ServicioNotificacionesEmail()
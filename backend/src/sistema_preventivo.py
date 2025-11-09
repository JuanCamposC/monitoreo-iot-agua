#!/usr/bin/env python3
"""
Sistema de Análisis Preventivo CIMARQ con Perceptron
Implementa predicciones y alertas automáticas para sensores de acuicultura
"""

import numpy as np
import pandas as pd
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import joblib
import os
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any
import logging
from pymongo import MongoClient
from bson import ObjectId
import pytz
import json

# Configuración de zona horaria Chile (GMT-3)
CHILE_TZ = pytz.timezone('America/Santiago')

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('SistemaPreventivoMLCIMARQ')

class SistemaPreventivoML:
    """Sistema completo de ML preventivo para sensores de acuicultura"""
    
    def __init__(self, mongo_uri: str, db_name: str = "cimarqdb"):
        """
        Inicializa el sistema preventivo con conexión a MongoDB
        
        Args:
            mongo_uri: URI de conexión a MongoDB
            db_name: Nombre de la base de datos
        """
        self.mongo_uri = mongo_uri
        self.db_name = db_name
        
        # Configuración de modelos Perceptron optimizados
        self.modelos = {
            'temperatura': MLPRegressor(
                hidden_layer_sizes=(50, 30, 15),
                activation='relu',
                solver='adam',
                alpha=0.0001,
                batch_size='auto',
                learning_rate='adaptive',
                max_iter=500,
                random_state=42,
                early_stopping=True,
                validation_fraction=0.1,
                n_iter_no_change=10
            ),
            'ph': MLPRegressor(
                hidden_layer_sizes=(40, 25, 10),
                activation='tanh',
                solver='adam',
                alpha=0.001,
                batch_size='auto',
                learning_rate='adaptive',
                max_iter=400,
                random_state=42,
                early_stopping=True,
                validation_fraction=0.1,
                n_iter_no_change=10
            ),
            'oxigeno': MLPRegressor(
                hidden_layer_sizes=(60, 40, 20),
                activation='relu',
                solver='adam',
                alpha=0.0005,
                batch_size='auto',
                learning_rate='adaptive',
                max_iter=600,
                random_state=42,
                early_stopping=True,
                validation_fraction=0.1,
                n_iter_no_change=15
            )
        }
        
        # Scalers para normalización
        self.scalers = {
            'temperatura': StandardScaler(),
            'ph': MinMaxScaler(feature_range=(-1, 1)),
            'oxigeno': StandardScaler()
        }
        
        # Rangos óptimos para acuicultura marina (Zona Centro Chile)
        self.rangos_optimos = {
            'temperatura': {
                'min_optimo': 12.0,
                'max_optimo': 18.0,
                'min_critico': 8.0,
                'max_critico': 22.0,
                'unidad': '°C'
            },
            'ph': {
                'min_optimo': 7.8,
                'max_optimo': 8.3,
                'min_critico': 7.0,
                'max_critico': 9.0,
                'unidad': 'pH'
            },
            'oxigeno': {
                'min_optimo': 6.0,
                'max_optimo': 10.0,
                'min_critico': 4.0,
                'max_critico': 15.0,
                'unidad': 'mg/L'
            }
        }
        
        # Directorio para guardar modelos entrenados
        self.modelo_dir = '/app/modelos_ml'
        os.makedirs(self.modelo_dir, exist_ok=True)
        
        # Conexión MongoDB
        self.client = None
        self.db = None
        self._conectar_mongodb()
        
        # Monitoreo automático activo
        self.monitoreo_activo = True
        
    def get_chile_time(self):
        """Obtiene la hora actual en zona horaria de Chile"""
        return datetime.now(CHILE_TZ)
        
    def _conectar_mongodb(self):
        """Establece conexión con MongoDB"""
        try:
            self.client = MongoClient(
                self.mongo_uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
                socketTimeoutMS=20000
            )
            self.db = self.client[self.db_name]
            # Verificar conexión
            self.client.admin.command('ping')
            logger.info(f"Conectado a MongoDB: {self.db_name}")
        except Exception as e:
            logger.error(f"Error conectando a MongoDB: {e}")
            raise
            
    def obtener_datos_entrenamiento(self, sensor: str, dias_historicos: int = 30) -> pd.DataFrame:
        """
        Obtiene datos históricos para entrenamiento del modelo
        
        Args:
            sensor: Nombre del sensor (temperatura, ph, oxigeno)
            dias_historicos: Días de historia a obtener
            
        Returns:
            DataFrame con datos para entrenamiento
        """
        try:
            fecha_limite = self.get_chile_time() - timedelta(days=dias_historicos)
            
            # Consultar datos desde MongoDB
            query = {
                sensor: {"$ne": None},
                "fecha": {"$gte": fecha_limite.timestamp() * 1000}  # Timestamp en ms
            }
            
            cursor = self.db.datos.find(query).sort("fecha", 1)
            datos = list(cursor)
            
            if not datos:
                logger.warning(f"No se encontraron datos para {sensor}")
                return pd.DataFrame()
                
            # Convertir a DataFrame
            df = pd.DataFrame(datos)
            
            # Procesar timestamps
            if 'fecha' in df.columns:
                df['fecha'] = pd.to_datetime(df['fecha'], unit='ms')
                df['fecha_chile'] = df['fecha'].dt.tz_localize('UTC').dt.tz_convert(CHILE_TZ)
            
            logger.info(f"Datos obtenidos para {sensor}: {len(df)} registros")
            return df
            
        except Exception as e:
            logger.error(f"Error obteniendo datos para {sensor}: {e}")
            return pd.DataFrame()
            
    def crear_features_temporales(self, df: pd.DataFrame, sensor: str) -> Tuple[np.ndarray, np.ndarray]:
        """
        Crea features temporales para el modelo de ML
        
        Args:
            df: DataFrame con datos del sensor
            sensor: Nombre del sensor
            
        Returns:
            Tupla (X, y) con features y targets
        """
        if df.empty or sensor not in df.columns:
            return np.array([]), np.array([])
            
        # Ordenar por fecha
        df = df.sort_values('fecha_chile').reset_index(drop=True)
        valores = df[sensor].values
        
        # Crear secuencias temporales (ventana deslizante)
        ventana = 10  # Usar últimas 10 lecturas para predecir la siguiente
        X, y = [], []
        
        for i in range(ventana, len(valores)):
            X.append(valores[i-ventana:i])
            y.append(valores[i])
            
        # Añadir features adicionales
        if len(X) > 0:
            X = np.array(X)
            y = np.array(y)
            
            # Features estadísticas
            X_stats = np.column_stack([
                np.mean(X, axis=1),      # Promedio
                np.std(X, axis=1),       # Desviación estándar
                np.min(X, axis=1),       # Mínimo
                np.max(X, axis=1),       # Máximo
                X[:, -1] - X[:, 0]       # Tendencia (último - primero)
            ])
            
            # Combinar features temporales con estadísticas
            X = np.column_stack([X, X_stats])
            
        return X, y
        
    def entrenar_modelo(self, sensor: str, dias_historicos: int = 30) -> Dict[str, Any]:
        """
        Entrena el modelo Perceptron para un sensor específico
        
        Args:
            sensor: Nombre del sensor
            dias_historicos: Días de datos históricos a usar
            
        Returns:
            Métricas del entrenamiento
        """
        logger.info(f"Iniciando entrenamiento para {sensor}")
        
        # Obtener datos
        df = self.obtener_datos_entrenamiento(sensor, dias_historicos)
        if df.empty:
            return {"error": f"No hay datos suficientes para {sensor}"}
            
        # Crear features
        X, y = self.crear_features_temporales(df, sensor)
        if len(X) == 0:
            return {"error": f"No se pudieron crear features para {sensor}"}
            
        # Dividir datos
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, shuffle=False
        )
        
        # Normalizar features
        X_train_scaled = self.scalers[sensor].fit_transform(X_train)
        X_test_scaled = self.scalers[sensor].transform(X_test)
        
        # Entrenar modelo
        tiempo_inicio = datetime.now()
        self.modelos[sensor].fit(X_train_scaled, y_train)
        tiempo_entrenamiento = (datetime.now() - tiempo_inicio).total_seconds()
        
        # Evaluar modelo
        y_pred_train = self.modelos[sensor].predict(X_train_scaled)
        y_pred_test = self.modelos[sensor].predict(X_test_scaled)
        
        metricas = {
            'sensor': sensor,
            'fecha_entrenamiento': self.get_chile_time().isoformat(),
            'datos_entrenamiento': len(X_train),
            'datos_test': len(X_test),
            'tiempo_entrenamiento': tiempo_entrenamiento,
            'r2_train': r2_score(y_train, y_pred_train),
            'r2_test': r2_score(y_test, y_pred_test),
            'mae_test': mean_absolute_error(y_test, y_pred_test),
            'rmse_test': np.sqrt(mean_squared_error(y_test, y_pred_test))
        }
        
        # Guardar modelo y scaler
        self._guardar_modelo(sensor)
        
        logger.info(f"{sensor} - R²:{metricas['r2_test']:.3f} | MAE:{metricas['mae_test']:.3f} | {tiempo_entrenamiento:.2f}s")
        return metricas
        
    def _guardar_modelo(self, sensor: str):
        """Guarda el modelo y scaler entrenados"""
        try:
            modelo_path = os.path.join(self.modelo_dir, f"{sensor}_modelo.joblib")
            scaler_path = os.path.join(self.modelo_dir, f"{sensor}_scaler.joblib")
            
            joblib.dump(self.modelos[sensor], modelo_path)
            joblib.dump(self.scalers[sensor], scaler_path)
            
            logger.info(f"Modelo {sensor} guardado en {modelo_path}")
        except Exception as e:
            logger.error(f"Error guardando modelo {sensor}: {e}")
            
    def cargar_modelo(self, sensor: str) -> bool:
        """
        Carga un modelo pre-entrenado
        
        Args:
            sensor: Nombre del sensor
            
        Returns:
            True si se cargó correctamente
        """
        try:
            modelo_path = os.path.join(self.modelo_dir, f"{sensor}_modelo.joblib")
            scaler_path = os.path.join(self.modelo_dir, f"{sensor}_scaler.joblib")
            
            if os.path.exists(modelo_path) and os.path.exists(scaler_path):
                self.modelos[sensor] = joblib.load(modelo_path)
                self.scalers[sensor] = joblib.load(scaler_path)
                logger.info(f"Modelo {sensor} cargado correctamente")
                return True
            else:
                logger.warning(f"No se encontró modelo pre-entrenado para {sensor}")
                return False
        except Exception as e:
            logger.error(f"Error cargando modelo {sensor}: {e}")
            return False
            
    def predecir_sensor(self, sensor: str, horas_futuro: int = 24) -> Dict[str, Any]:
        """
        Genera predicciones para un sensor específico
        
        Args:
            sensor: Nombre del sensor
            horas_futuro: Horas a predecir hacia el futuro
            
        Returns:
            Diccionario con predicciones y análisis
        """
        try:
            # Obtener datos recientes para predicción
            df = self.obtener_datos_entrenamiento(sensor, dias_historicos=2)
            if df.empty or len(df) < 10:
                return {"error": f"Datos insuficientes para {sensor}"}
                
            # Preparar últimas lecturas
            valores_recientes = df[sensor].tail(10).values
            
            # Crear features para predicción
            X_pred = []
            valores_actuales = list(valores_recientes)
            
            predicciones = []
            timestamps_futuros = []
            
            # Generar predicciones secuenciales
            for i in range(horas_futuro):
                # Crear features con últimas 10 lecturas
                if len(valores_actuales) >= 10:
                    ventana = np.array(valores_actuales[-10:])
                    
                    # Features estadísticas
                    features = np.array([
                        np.concatenate([
                            ventana,
                            [np.mean(ventana), np.std(ventana), 
                             np.min(ventana), np.max(ventana),
                             ventana[-1] - ventana[0]]
                        ])
                    ])
                    
                    # Normalizar y predecir
                    features_scaled = self.scalers[sensor].transform(features)
                    pred = self.modelos[sensor].predict(features_scaled)[0]
                    
                    predicciones.append(float(pred))
                    valores_actuales.append(pred)
                    
                    # Timestamp futuro
                    timestamp_futuro = self.get_chile_time() + timedelta(hours=i+1)
                    timestamps_futuros.append(timestamp_futuro.isoformat())
            
            # Análizar predicciones
            analisis = self._analizar_predicciones(sensor, predicciones)
            
            return {
                'sensor': sensor,
                'predicciones': predicciones,
                'timestamps': timestamps_futuros,
                'valor_actual': float(valores_recientes[-1]),
                'analisis': analisis,
                'fecha_prediccion': self.get_chile_time().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error prediciendo {sensor}: {e}")
            return {"error": str(e)}
            
    def _analizar_predicciones(self, sensor: str, predicciones: List[float]) -> Dict[str, Any]:
        """Analiza las predicciones y genera insights"""
        rangos = self.rangos_optimos[sensor]
        
        # Estadísticas básicas
        pred_array = np.array(predicciones)
        
        # Contar valores fuera de rango
        fuera_optimo = np.sum((pred_array < rangos['min_optimo']) | 
                             (pred_array > rangos['max_optimo']))
        fuera_critico = np.sum((pred_array < rangos['min_critico']) | 
                              (pred_array > rangos['max_critico']))
        
        # Tendencia
        if len(predicciones) > 1:
            tendencia = "aumentando" if predicciones[-1] > predicciones[0] else "disminuyendo"
            cambio_porcentual = ((predicciones[-1] - predicciones[0]) / predicciones[0]) * 100
        else:
            tendencia = "estable"
            cambio_porcentual = 0.0
            
        return {
            'promedio': float(np.mean(pred_array)),
            'minimo': float(np.min(pred_array)),
            'maximo': float(np.max(pred_array)),
            'tendencia': tendencia,
            'cambio_porcentual': round(cambio_porcentual, 2),
            'horas_fuera_optimo': int(fuera_optimo),
            'horas_fuera_critico': int(fuera_critico),
            'nivel_alerta': self._calcular_nivel_alerta(sensor, predicciones)
        }
        
    def _calcular_nivel_alerta(self, sensor: str, predicciones: List[float]) -> str:
        """Calcula el nivel de alerta basado en las predicciones"""
        rangos = self.rangos_optimos[sensor]
        pred_array = np.array(predicciones)
        
        # Verificar valores críticos
        critico = np.any((pred_array < rangos['min_critico']) | 
                        (pred_array > rangos['max_critico']))
        
        # Verificar valores fuera del rango óptimo
        fuera_optimo = np.sum((pred_array < rangos['min_optimo']) | 
                             (pred_array > rangos['max_optimo']))
        
        if critico:
            return "CRITICO"
        elif fuera_optimo > len(predicciones) * 0.3:  # Más del 30% fuera del rango
            return "ALTO"
        elif fuera_optimo > 0:
            return "MEDIO"
        else:
            return "NORMAL"
            
    def generar_alerta(self, sensor: str, prediccion_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Genera una alerta basada en las predicciones
        
        Args:
            sensor: Nombre del sensor
            prediccion_data: Datos de predicción
            
        Returns:
            Diccionario con la alerta generada
        """
        analisis = prediccion_data.get('analisis', {})
        nivel = analisis.get('nivel_alerta', 'NORMAL')
        
        if nivel == 'NORMAL':
            return None  # No generar alerta si está normal
            
        # Generar mensaje y sugerencias
        mensaje, sugerencias = self._generar_mensaje_sugerencias(sensor, prediccion_data)
        
        alerta = {
            '_id': str(ObjectId()),
            'sensor': sensor,
            'nivel': nivel,
            'mensaje': mensaje,
            'sugerencias': sugerencias,
            'valor_actual': prediccion_data.get('valor_actual'),
            'predicciones': prediccion_data.get('predicciones', []),
            'analisis': analisis,
            'fecha_creacion': self.get_chile_time(),
            'fecha_creacion_timestamp': int(self.get_chile_time().timestamp() * 1000),
            'resuelto': False,
            'prioridad': self._calcular_prioridad(nivel),
            'acciones_recomendadas': self._generar_acciones(sensor, nivel, analisis)
        }
        
        return alerta
        
    def _generar_mensaje_sugerencias(self, sensor: str, prediccion_data: Dict[str, Any]) -> Tuple[str, List[str]]:
        """Genera mensaje descriptivo y lista de sugerencias"""
        analisis = prediccion_data.get('analisis', {})
        rangos = self.rangos_optimos[sensor]
        nivel = analisis.get('nivel_alerta', 'NORMAL')
        
        # Mensajes por sensor y nivel
        mensajes = {
            'temperatura': {
                'CRITICO': f"TEMPERATURA CRÍTICA: Valores predichos fuera del rango seguro ({rangos['min_critico']}-{rangos['max_critico']}°C)",
                'ALTO': f"TEMPERATURA ELEVADA: Valores predichos fuera del rango óptimo ({rangos['min_optimo']}-{rangos['max_optimo']}°C)",
                'MEDIO': f"TEMPERATURA SUBÓPTIMA: Algunos valores predichos fuera del rango ideal"
            },
            'ph': {
                'CRITICO': f"pH CRÍTICO: Acidez/alcalinidad peligrosa para la vida acuática ({rangos['min_critico']}-{rangos['max_critico']})",
                'ALTO': f"pH DESEQUILIBRADO: Valores fuera del rango óptimo ({rangos['min_optimo']}-{rangos['max_optimo']})",
                'MEDIO': f"pH SUBÓPTIMO: Ligero desequilibrio en la acidez del agua"
            },
            'oxigeno': {
                'CRITICO': f"OXÍGENO CRÍTICO: Niveles peligrosos para la vida acuática ({rangos['min_critico']}-{rangos['max_critico']} mg/L)",
                'ALTO': f"OXÍGENO BAJO/ALTO: Fuera del rango óptimo ({rangos['min_optimo']}-{rangos['max_optimo']} mg/L)",
                'MEDIO': f"OXÍGENO SUBÓPTIMO: Niveles no ideales para el crecimiento"
            }
        }
        
        mensaje = mensajes.get(sensor, {}).get(nivel, "Alerta generada por sistema ML")
        
        # Sugerencias específicas
        sugerencias = self._generar_sugerencias_especificas(sensor, nivel, analisis, prediccion_data)
        
        return mensaje, sugerencias
        
    def _generar_sugerencias_especificas(self, sensor: str, nivel: str, analisis: Dict, prediccion_data: Dict) -> List[str]:
        """Genera sugerencias específicas basadas en el sensor y análisis"""
        sugerencias = []
        tendencia = analisis.get('tendencia', 'estable')
        valor_actual = prediccion_data.get('valor_actual', 0)
        rangos = self.rangos_optimos[sensor]
        
        if sensor == 'temperatura':
            if valor_actual < rangos['min_optimo']:
                sugerencias.extend([
                    "Instalar calentadores de agua adicionales",
                    "Reducir flujo de agua fría de entrada",
                    "Mejorar aislamiento térmico del estanque",
                    "Optimizar exposición solar directa"
                ])
            elif valor_actual > rangos['max_optimo']:
                sugerencias.extend([
                    "Aumentar ventilación y circulación de agua",
                    "Incrementar flujo de agua fría",
                    "Instalar sistemas de enfriamiento",
                    "Proporcionar sombra adicional"
                ])
                
        elif sensor == 'ph':
            if valor_actual < rangos['min_optimo']:  # Muy ácido
                sugerencias.extend([
                    "Agregar cal hidratada o bicarbonato de sodio",
                    "Instalar filtros con medios alcalinos",
                    "Aumentar aireación para reducir CO2",
                    "Verificar niveles de CO2 disuelto"
                ])
            elif valor_actual > rangos['max_optimo']:  # Muy alcalino
                sugerencias.extend([
                    "Agregar ácidos orgánicos controladamente",
                    "Aumentar renovación de agua",
                    "Usar medios filtrantes ácidos",
                    "Monitorear niveles de amoníaco"
                ])
                
        elif sensor == 'oxigeno':
            if valor_actual < rangos['min_optimo']:
                sugerencias.extend([
                    "Instalar aireadores adicionales o más potentes",
                    "Aumentar circulación y movimiento del agua",
                    "Reducir densidad de peces temporalmente",
                    "Verificar y limpiar filtros biológicos"
                ])
            elif valor_actual > rangos['max_optimo']:
                sugerencias.extend([
                    "Reducir intensidad de aireación",
                    "Ajustar flujo de agua para equilibrar O2",
                    "Verificar temperatura (agua fría retiene más O2)",
                    "Monitorear niveles durante la noche"
                ])
        
        # Sugerencias generales por nivel
        if nivel == 'CRITICO':
            sugerencias.extend([
                "ACCIÓN INMEDIATA: Implementar medidas correctivas en las próximas 2-4 horas",
                "Contactar al responsable técnico de acuicultura",
                "Activar protocolo de emergencia del sistema"
            ])
        elif nivel == 'ALTO':
            sugerencias.extend([
                "Implementar correcciones en las próximas 6-12 horas",
                "Aumentar frecuencia de monitoreo manual"
            ])
            
        return sugerencias
        
    def _calcular_prioridad(self, nivel: str) -> int:
        """Calcula prioridad numérica para ordenamiento"""
        prioridades = {
            'CRITICO': 4,
            'ALTO': 3,
            'MEDIO': 2,
            'NORMAL': 1
        }
        return prioridades.get(nivel, 1)
        
    def _generar_acciones(self, sensor: str, nivel: str, analisis: Dict) -> List[str]:
        """Genera lista de acciones específicas a tomar"""
        acciones = []
        
        if nivel == 'CRITICO':
            acciones.extend([
                "Verificación manual inmediata del parámetro",
                "Implementación de medidas correctivas de emergencia",
                "Notificación al supervisor responsable",
                "Documentación del incidente y acciones tomadas"
            ])
        elif nivel == 'ALTO':
            acciones.extend([
                "Monitoreo reforzado cada 2 horas",
                "Preparación de medidas correctivas",
                "Revisión de equipos relacionados"
            ])
        else:
            acciones.extend([
                "Monitoreo preventivo",
                "Revisión de tendencias históricas"
            ])
            
        return acciones
        
    def guardar_alerta(self, alerta: Dict[str, Any]) -> str:
        """
        Guarda una alerta en la base de datos
        
        Args:
            alerta: Diccionario con datos de la alerta
            
        Returns:
            ID de la alerta guardada
        """
        try:
            # Serializar datos para MongoDB
            alerta_mongo = alerta.copy()
            
            # Convertir datetime a timestamp para MongoDB
            if isinstance(alerta_mongo.get('fecha_creacion'), datetime):
                alerta_mongo['fecha_creacion'] = alerta_mongo['fecha_creacion'].isoformat()
                
            resultado = self.db.alertas.insert_one(alerta_mongo)
            logger.info(f"Alerta guardada: {resultado.inserted_id}")
            return str(resultado.inserted_id)
            
        except Exception as e:
            logger.error(f"Error guardando alerta: {e}")
            return None
            
    def obtener_alertas_activas(self, limite: int = 50) -> List[Dict]:
        """Obtiene las alertas activas más recientes"""
        try:
            cursor = self.db.alertas.find(
                {"resuelto": False}
            ).sort("fecha_creacion_timestamp", -1).limit(limite)
            
            alertas = list(cursor)
            
            # Serializar ObjectIds
            for alerta in alertas:
                if '_id' in alerta:
                    alerta['_id'] = str(alerta['_id'])
                    
            return alertas
            
        except Exception as e:
            logger.error(f"Error obteniendo alertas: {e}")
            return []
    
    def obtener_ultimo_valor(self, sensor: str) -> Dict[str, Any]:
        """
        Obtiene el último valor registrado de un sensor
        
        Args:
            sensor: Nombre del sensor
            
        Returns:
            Diccionario con el último valor y metadata
        """
        try:
            # Obtener el documento más reciente con valor para este sensor
            query = {sensor: {"$ne": None}}
            ultimo_doc = self.db.datos.find(query).sort("fecha", -1).limit(1)
            
            documento = list(ultimo_doc)
            if not documento:
                return None
                
            doc = documento[0]
            fecha_raw = doc.get('fecha', 0)
            
            # Manejar diferentes formatos de fecha
            if isinstance(fecha_raw, datetime):
                # Ya es un objeto datetime
                if fecha_raw.tzinfo is None:
                    # Si no tiene timezone, asumimos que es Chile
                    fecha_chile = CHILE_TZ.localize(fecha_raw)
                else:
                    # Si ya tiene timezone, convertir a Chile
                    fecha_chile = fecha_raw.astimezone(CHILE_TZ)
            else:
                # Es un timestamp en milliseconds
                fecha_chile = datetime.fromtimestamp(fecha_raw / 1000, tz=CHILE_TZ)
            
            return {
                'sensor': sensor,
                'valor': doc.get(sensor),
                'fecha': fecha_chile,
                'documento_id': str(doc.get('_id'))
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo último valor de {sensor}: {e}")
            return None
    
    def verificar_valor_en_rango(self, sensor: str, valor: float) -> Dict[str, Any]:
        """
        Verifica si un valor está dentro del rango permitido para el sensor
        
        Args:
            sensor: Nombre del sensor
            valor: Valor a verificar
            
        Returns:
            Diccionario con resultado de la verificación
        """
        if sensor not in self.rangos_optimos:
            return {'en_rango': True, 'nivel': 'NORMAL', 'mensaje': 'Sensor no configurado'}
            
        rango = self.rangos_optimos[sensor]
        
        # Verificar rangos críticos
        if valor < rango['min_critico'] or valor > rango['max_critico']:
            return {
                'en_rango': False,
                'nivel': 'CRITICO',
                'mensaje': f"{sensor.upper()} CRÍTICO: Valor {valor} fuera del rango seguro ({rango['min_critico']}-{rango['max_critico']} {rango['unidad']})",
                'tipo_problema': 'fuera_rango_critico',
                'valor': valor,
                'rango_min': rango['min_critico'],
                'rango_max': rango['max_critico']
            }
        
        # Verificar rangos óptimos
        if valor < rango['min_optimo'] or valor > rango['max_optimo']:
            return {
                'en_rango': False,
                'nivel': 'ALTO',
                'mensaje': f"{sensor.upper()} ALTO: Valor {valor} fuera del rango óptimo ({rango['min_optimo']}-{rango['max_optimo']} {rango['unidad']})",
                'tipo_problema': 'fuera_rango_optimo',
                'valor': valor,
                'rango_min': rango['min_optimo'],
                'rango_max': rango['max_optimo']
            }
        
        return {
            'en_rango': True,
            'nivel': 'NORMAL',
            'mensaje': f"{sensor.upper()} NORMAL: Valor {valor} dentro del rango óptimo",
            'valor': valor
        }
    
    def generar_alerta_tiempo_real(self, sensor: str, valor: float) -> Dict[str, Any]:
        """
        Genera una alerta en tiempo real basada en el valor actual del sensor
        
        Args:
            sensor: Nombre del sensor
            valor: Valor actual del sensor
            
        Returns:
            Diccionario con la alerta generada o None si no hay problema
        """
        verificacion = self.verificar_valor_en_rango(sensor, valor)
        
        if verificacion['en_rango']:
            return None  # No generar alerta si está en rango normal
            
        # Crear alerta
        alerta = {
            'sensor': sensor,
            'tipo': 'tiempo_real',
            'nivel': verificacion['nivel'],
            'mensaje': verificacion['mensaje'],
            'valor_actual': valor,
            'fecha_creacion': self.get_chile_time(),
            'resuelto': False,
            'prioridad': 4 if verificacion['nivel'] == 'CRITICO' else 3,
            'tipo_problema': verificacion['tipo_problema']
        }
        
        # Agregar sugerencias según el sensor y tipo de problema
        alerta['sugerencias'] = self._generar_sugerencias(sensor, verificacion)
        alerta['acciones_recomendadas'] = self._generar_acciones_recomendadas(verificacion['nivel'])
        
        return alerta
    
    def _generar_sugerencias(self, sensor: str, verificacion: Dict[str, Any]) -> List[str]:
        """
        Genera sugerencias básicas para el sensor y tipo de problema
        
        Args:
            sensor: Nombre del sensor
            verificacion: Resultado de verificar_valor_en_rango
            
        Returns:
            Lista de sugerencias específicas
        """
        sugerencias = []
        valor = verificacion.get('valor', 0)
        nivel = verificacion.get('nivel', 'NORMAL')
        rangos = self.rangos_optimos[sensor]
        
        if nivel == 'CRITICO':
            if sensor == 'temperatura':
                if valor < rangos['min_critico']:
                    sugerencias = [
                        "EMERGENCIA: Instalar calentadores inmediatamente",
                        "Verificar sistemas de calefacción",
                        "Monitorear temperatura cada 15 minutos"
                    ]
                else:
                    sugerencias = [
                        "EMERGENCIA: Aumentar enfriamiento inmediatamente",
                        "Incrementar flujo de agua fría",
                        "Monitorear temperatura cada 15 minutos"
                    ]
            elif sensor == 'ph':
                if valor < rangos['min_critico']:
                    sugerencias = [
                        "EMERGENCIA: Agua muy ácida - agregar cal inmediatamente",
                        "Aplicar bicarbonato de sodio gradualmente",
                        "Verificar pH cada 30 minutos"
                    ]
                else:
                    sugerencias = [
                        "EMERGENCIA: Agua muy alcalina - reducir pH inmediatamente",
                        "Agregar ácido cítrico diluido gradualmente",
                        "Verificar pH cada 30 minutos"
                    ]
            elif sensor == 'oxigeno':
                if valor < rangos['min_critico']:
                    sugerencias = [
                        "EMERGENCIA: Oxígeno crítico - aumentar aireación máxima",
                        "Activar todos los sistemas de aireación",
                        "Reducir densidad de peces inmediatamente"
                    ]
                else:
                    sugerencias = [
                        "EMERGENCIA: Exceso de oxígeno - reducir aireación",
                        "Disminuir potencia de aireadores",
                        "Aumentar circulación de agua"
                    ]
        
        elif nivel == 'ADVERTENCIA':
            if sensor == 'temperatura':
                sugerencias = [
                    f"Temperatura fuera del rango óptimo ({rangos['min_optimo']}-{rangos['max_optimo']}°C)",
                    "Ajustar sistemas de control térmico",
                    "Monitorear evolución próximas 2 horas"
                ]
            elif sensor == 'ph':
                sugerencias = [
                    f"pH fuera del rango óptimo ({rangos['min_optimo']}-{rangos['max_optimo']})",
                    "Ajustar balance ácido-base gradualmente",
                    "Verificar pH en 1 hora"
                ]
            elif sensor == 'oxigeno':
                sugerencias = [
                    f"Oxígeno fuera del rango óptimo ({rangos['min_optimo']}-{rangos['max_optimo']} mg/L)",
                    "Ajustar sistemas de aireación",
                    "Monitorear en próximos 30 minutos"
                ]
        
        return sugerencias
    
    def _generar_acciones_recomendadas(self, nivel: str) -> List[str]:
        """
        Genera acciones recomendadas según el nivel de alerta
        
        Args:
            nivel: Nivel de la alerta (CRITICO, ADVERTENCIA, NORMAL)
            
        Returns:
            Lista de acciones recomendadas
        """
        if nivel == 'CRITICO':
            return [
                "Acción inmediata requerida",
                "Notificar al técnico responsable",
                "Documentar acciones tomadas",
                "Verificar cada 15-30 minutos hasta normalizar"
            ]
        elif nivel == 'ADVERTENCIA':
            return [
                "Monitoreo frecuente recomendado",
                "Revisar tendencias de las últimas horas",
                "Preparar equipos de ajuste si es necesario",
                "Verificar en 1-2 horas"
            ]
        else:
            return [
                "Mantener monitoreo rutinario",
                "Continuar con mediciones regulares"
            ]
    
    def monitorear_sensores_tiempo_real(self) -> Dict[str, Any]:
        """
        Monitorea todos los sensores en tiempo real y genera alertas si es necesario
        
        Returns:
            Diccionario con resultados del monitoreo
        """
        resultado = {
            'timestamp': self.get_chile_time().isoformat(),
            'sensores_monitoreados': [],
            'alertas_generadas': [],
            'valores_normales': [],
            'errores': []
        }
        
        for sensor in ['temperatura', 'ph', 'oxigeno']:
            try:
                # Obtener último valor
                ultimo_valor = self.obtener_ultimo_valor(sensor)
                if not ultimo_valor:
                    continue
                
                resultado['sensores_monitoreados'].append({
                    'sensor': sensor,
                    'valor': ultimo_valor['valor'],
                    'fecha': ultimo_valor['fecha'].isoformat()
                })
                
                # Verificar y generar alerta si es necesario
                alerta = self.generar_alerta_tiempo_real(sensor, ultimo_valor['valor'])
                
                if alerta:
                    # Guardar alerta en MongoDB
                    alerta_id = self.guardar_alerta(alerta)
                    if alerta_id:
                        resultado['alertas_generadas'].append({
                            'sensor': sensor,
                            'nivel': alerta['nivel'],
                            'mensaje': alerta['mensaje'],
                            'alerta_id': alerta_id
                        })
                        logger.warning(f"Alerta {alerta['nivel']} generada para {sensor}: {alerta['mensaje']}")
                else:
                    resultado['valores_normales'].append({
                        'sensor': sensor,
                        'valor': ultimo_valor['valor']
                    })
                    
            except Exception as e:
                error_msg = f"Error monitoreando {sensor}: {str(e)}"
                resultado['errores'].append(error_msg)
                logger.error(f"{error_msg}")
        
        return resultado
            
    def procesar_sistema_completo(self) -> Dict[str, Any]:
        """
        Ejecuta el análisis completo: entrena modelos, genera predicciones y alertas
        
        Returns:
            Resumen del procesamiento completo
        """
        logger.info("Iniciando sistema preventivo completo CIMARQ")
        
        resultado = {
            'fecha_procesamiento': self.get_chile_time().isoformat(),
            'modelos_entrenados': {},
            'predicciones': {},
            'alertas_generadas': [],
            'errores': []
        }
        
        sensores = ['temperatura', 'ph', 'oxigeno']
        
        # 1. Entrenar/Cargar modelos
        for sensor in sensores:
            try:
                # Intentar cargar modelo existente, si no existe, entrenar uno nuevo
                if not self.cargar_modelo(sensor):
                    metricas = self.entrenar_modelo(sensor)
                    resultado['modelos_entrenados'][sensor] = metricas
                else:
                    resultado['modelos_entrenados'][sensor] = {"cargado": True}
                    
            except Exception as e:
                error_msg = f"Error procesando modelo {sensor}: {str(e)}"
                resultado['errores'].append(error_msg)
                logger.error(f"{error_msg}")
                continue
        
        # 2. Generar predicciones
        for sensor in sensores:
            try:
                prediccion = self.predecir_sensor(sensor, horas_futuro=24)
                resultado['predicciones'][sensor] = prediccion
                
                # 3. Generar y guardar alertas
                alerta = self.generar_alerta(sensor, prediccion)
                if alerta:
                    alerta_id = self.guardar_alerta(alerta)
                    if alerta_id:
                        resultado['alertas_generadas'].append({
                            'sensor': sensor,
                            'nivel': alerta['nivel'],
                            'alerta_id': alerta_id
                        })
                        
            except Exception as e:
                error_msg = f"Error generando predicción/alerta {sensor}: {str(e)}"
                resultado['errores'].append(error_msg)
                logger.error(f"{error_msg}")
                
        logger.info(f"Sistema completado: {len(resultado['alertas_generadas'])} alertas generadas")
        return resultado

if __name__ == "__main__":
    # Configuración para testing
    MONGO_URI = "mongodb+srv://cimarq:eGEr87FyYHIadm4p@proyectotitulo.idqwtmo.mongodb.net/"
    
    # Inicializar sistema
    sistema = SistemaPreventivoML(MONGO_URI)
    
    # Ejecutar procesamiento completo
    resultado = sistema.procesar_sistema_completo()
    
    print("RESUMEN DEL SISTEMA PREVENTIVO")
    print("=" * 50)
    print(f"Fecha: {resultado['fecha_procesamiento']}")
    print(f"Modelos: {len(resultado['modelos_entrenados'])}")
    print(f"Predicciones: {len(resultado['predicciones'])}")
    print(f"Alertas: {len(resultado['alertas_generadas'])}")
    print(f"Errores: {len(resultado['errores'])}")
    
    # Mostrar alertas generadas
    if resultado['alertas_generadas']:
        print("\nALERTAS GENERADAS:")
        for alerta in resultado['alertas_generadas']:
            print(f"  • {alerta['sensor']}: {alerta['nivel']} (ID: {alerta['alerta_id']})")
#!/usr/bin/env python3
"""
CIMARQ - Análisis Predictivo de Sensores IoT (Predicción 24h)
============================================================

Sistema simple de comparación de modelos ML para sensores acuícolas:
- ARIMA, SARIMA, Prophet, LSTM, Perceptron

Objetivo: Predicción a 24 horas de Temperatura, pH y Oxígeno Disuelto
Salida: Reporte comparativo en carpeta /resultados
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import time
import warnings
import os
import json
warnings.filterwarnings('ignore')

# Silenciar warnings de TensorFlow
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf
tf.get_logger().setLevel('ERROR')

# ML y métricas
from sklearn.preprocessing import MinMaxScaler
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Series temporales
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX

# LSTM
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

# Prophet
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    print("⚠️ Prophet no disponible, se omitirá del análisis")

class PredictorSensores24h:
    """Predictor simple para sensores acuícolas con horizonte de 24 horas"""
    
    def __init__(self, csv_path='brisbane_water_quality.csv'):
        self.csv_path = csv_path
        self.df = None
        self.resultados = {}
        self.crear_carpeta_resultados()
        
    def crear_carpeta_resultados(self):
        """Crear carpeta de resultados si no existe"""
        if not os.path.exists('resultados'):
            os.makedirs('resultados')
            
    def cargar_datos(self):
        """Cargar y preparar datos para predicción a 24h"""
        print("📊 Cargando datos...")
        
        try:
            # Cargar CSV
            df = pd.read_csv(self.csv_path)
            print(f"✅ Dataset cargado: {df.shape[0]} registros, {df.shape[1]} columnas")
            
            # Mapear columnas a español
            columnas_map = {
                'Timestamp': 'fecha',
                'Temperature': 'temperatura', 
                'pH': 'ph',
                'Dissolved Oxygen': 'oxigeno'
            }
            
            # Renombrar columnas que existan
            for col_eng, col_esp in columnas_map.items():
                if col_eng in df.columns:
                    df = df.rename(columns={col_eng: col_esp})
            
            # Convertir fecha
            df['fecha'] = pd.to_datetime(df['fecha'])
            df = df.sort_values('fecha').reset_index(drop=True)
            
            # Variables objetivo
            sensores = ['temperatura', 'ph', 'oxigeno']
            missing = [s for s in sensores if s not in df.columns]
            
            if missing:
                print(f"❌ Columnas faltantes: {missing}")
                print(f"📋 Columnas disponibles: {list(df.columns)}")
                return False
                
            # Limpiar datos
            df_clean = df[['fecha'] + sensores].copy()
            
            # Eliminar valores nulos
            antes = len(df_clean)
            df_clean = df_clean.dropna()
            despues = len(df_clean)
            
            if antes != despues:
                print(f"🧹 Eliminados {antes-despues} registros con valores nulos")
                
            # Detectar outliers (método simple IQR)
            for sensor in sensores:
                Q1 = df_clean[sensor].quantile(0.25)
                Q3 = df_clean[sensor].quantile(0.75)
                IQR = Q3 - Q1
                limite_inf = Q1 - 1.5 * IQR
                limite_sup = Q3 + 1.5 * IQR
                
                outliers = (df_clean[sensor] < limite_inf) | (df_clean[sensor] > limite_sup)
                if outliers.sum() > 0:
                    print(f"🔍 {sensor}: {outliers.sum()} outliers detectados y eliminados")
                    df_clean = df_clean[~outliers]
            
            self.df = df_clean.reset_index(drop=True)
            print(f"✅ Datos limpios: {len(self.df)} registros finales")
            
            # Estadísticas básicas
            print("\n📈 Estadísticas del dataset:")
            for sensor in sensores:
                stats = self.df[sensor].describe()
                print(f"{sensor.title()}: μ={stats['mean']:.2f}, σ={stats['std']:.2f}, min={stats['min']:.2f}, max={stats['max']:.2f}")
                
            return True
            
        except Exception as e:
            print(f"❌ Error cargando datos: {e}")
            return False
    
    def preparar_datos_24h(self, sensor, test_size=0.2):
        """Preparar datos para predicción a 24 horas"""
        
        # 24 horas = 24 puntos (asumiendo 1 medición por hora)
        HORIZONTE_24H = 24
        
        serie = self.df[sensor].values
        
        # Crear secuencias para entrenamiento
        X, y = [], []
        for i in range(len(serie) - HORIZONTE_24H):
            X.append(serie[i:i+HORIZONTE_24H])  # 24h de historia
            y.append(serie[i+HORIZONTE_24H])    # valor a predecir
            
        X, y = np.array(X), np.array(y)
        
        # División temporal (no aleatoria)
        split_idx = int(len(X) * (1 - test_size))
        
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        return X_train, X_test, y_train, y_test, HORIZONTE_24H
    
    def calcular_metricas(self, y_true, y_pred, modelo_nombre, sensor, tiempo_entrenamiento=0, tiempo_prediccion=0):
        """Calcular métricas de evaluación incluyendo tiempos"""
        
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        r2 = r2_score(y_true, y_pred)
        
        # MAPE (evitando división por cero)
        mape = np.mean(np.abs((y_true - y_pred) / np.where(y_true != 0, y_true, 1))) * 100
        
        # Score de eficiencia (precisión / tiempo total)
        tiempo_total = tiempo_entrenamiento + tiempo_prediccion
        score_eficiencia = r2 / (tiempo_total + 0.001) if tiempo_total > 0 else r2  # Evitar división por 0
        
        return {
            'modelo': modelo_nombre,
            'sensor': sensor,
            'MAE': mae,
            'RMSE': rmse,
            'R2': r2,
            'MAPE': mape,
            'tiempo_entrenamiento': tiempo_entrenamiento,
            'tiempo_prediccion': tiempo_prediccion,
            'tiempo_total': tiempo_total,
            'score_eficiencia': score_eficiencia
        }
    
    def modelo_arima(self, sensor):
        """Modelo ARIMA simple para predicción 24h"""
        print(f"🔄 Entrenando ARIMA - {sensor}")
        
        # Iniciar medición de tiempo total
        tiempo_inicio_total = time.time()
        
        try:
            X_train, X_test, y_train, y_test, _ = self.preparar_datos_24h(sensor)
            
            if len(y_test) == 0:
                print(f"❌ Error ARIMA {sensor}: No hay datos de prueba suficientes")
                return None
            
            # Usar solo los últimos valores para ajuste ARIMA
            serie_train = self.df[sensor].iloc[:-len(y_test)]
            
            if len(serie_train) < 50:  # Mínimo para ARIMA
                print(f"❌ Error ARIMA {sensor}: Datos insuficientes (mínimo 50 puntos)")
                return None
            
            # Medir tiempo de entrenamiento
            tiempo_inicio_entrenamiento = time.time()
            
            # Intentar diferentes órdenes ARIMA si falla
            ordenes = [(1, 1, 1), (2, 1, 2), (1, 1, 2), (2, 1, 1)]
            
            for orden in ordenes:
                try:
                    modelo = ARIMA(serie_train, order=orden)
                    modelo_fit = modelo.fit()
                    break
                except:
                    continue
            else:
                print(f"❌ Error ARIMA {sensor}: No se pudo ajustar ningún orden ARIMA")
                return None
            
            tiempo_entrenamiento = time.time() - tiempo_inicio_entrenamiento
            
            # Medir tiempo de predicción
            tiempo_inicio_prediccion = time.time()
            predicciones = modelo_fit.forecast(steps=len(y_test))
            tiempo_prediccion = time.time() - tiempo_inicio_prediccion
            
            return self.calcular_metricas(y_test, predicciones, 'ARIMA', sensor, 
                                        tiempo_entrenamiento, tiempo_prediccion)
            
        except Exception as e:
            print(f"❌ Error ARIMA {sensor}: {str(e)[:100]}...")
            return None
    
    def modelo_sarima(self, sensor):
        """Modelo SARIMA para predicción 24h"""
        print(f"🔄 Entrenando SARIMA - {sensor}")
        
        try:
            X_train, X_test, y_train, y_test, _ = self.preparar_datos_24h(sensor)
            
            if len(y_test) == 0:
                print(f"❌ Error SARIMA {sensor}: No hay datos de prueba suficientes")
                return None
                
            serie_train = self.df[sensor].iloc[:-len(y_test)]
            
            if len(serie_train) < 100:  # SARIMA necesita más datos
                print(f"❌ Error SARIMA {sensor}: Datos insuficientes (mínimo 100 puntos)")
                return None
            
            # Medir tiempo de entrenamiento
            tiempo_inicio_entrenamiento = time.time()
            
            # Intentar diferentes configuraciones SARIMA
            configuraciones = [
                ((1, 1, 1), (1, 0, 1, 24)),
                ((2, 1, 2), (1, 0, 1, 12)),  # Estacionalidad 12h
                ((1, 1, 1), (0, 1, 1, 24)),
                ((1, 1, 0), (1, 0, 0, 24))
            ]
            
            modelo_fit = None
            for orden, orden_seasonal in configuraciones:
                try:
                    modelo = SARIMAX(serie_train, order=orden, seasonal_order=orden_seasonal)
                    modelo_fit = modelo.fit(disp=False, maxiter=50)
                    break
                except Exception as e:
                    continue
            
            if modelo_fit is None:
                print(f"❌ Error SARIMA {sensor}: No se pudo ajustar ninguna configuración")
                return None
            
            tiempo_entrenamiento = time.time() - tiempo_inicio_entrenamiento
            
            # Medir tiempo de predicción
            tiempo_inicio_prediccion = time.time()
            predicciones = modelo_fit.forecast(steps=len(y_test))
            tiempo_prediccion = time.time() - tiempo_inicio_prediccion
            
            return self.calcular_metricas(y_test, predicciones, 'SARIMA', sensor,
                                        tiempo_entrenamiento, tiempo_prediccion)
            
        except Exception as e:
            print(f"❌ Error SARIMA {sensor}: {str(e)[:100]}...")
            return None
    
    def modelo_prophet(self, sensor):
        """Modelo Prophet para predicción 24h"""
        if not PROPHET_AVAILABLE:
            return None
            
        print(f"🔄 Entrenando Prophet - {sensor}")
        
        try:
            # Preparar datos para Prophet
            df_prophet = self.df[['fecha', sensor]].copy()
            df_prophet.columns = ['ds', 'y']
            
            # Dividir datos temporalmente
            split_idx = int(len(df_prophet) * 0.8)
            train_prophet = df_prophet.iloc[:split_idx]
            test_prophet = df_prophet.iloc[split_idx:]
            
            # Medir tiempo de entrenamiento
            tiempo_inicio_entrenamiento = time.time()
            
            # Entrenar modelo
            modelo = Prophet(
                daily_seasonality=True,
                weekly_seasonality=False,
                yearly_seasonality=False,
                interval_width=0.95
            )
            modelo.fit(train_prophet)
            
            tiempo_entrenamiento = time.time() - tiempo_inicio_entrenamiento
            
            # Medir tiempo de predicción
            tiempo_inicio_prediccion = time.time()
            
            # Predicciones
            future = modelo.make_future_dataframe(periods=len(test_prophet), freq='H')
            prediccion = modelo.predict(future)
            
            tiempo_prediccion = time.time() - tiempo_inicio_prediccion
            
            # Extraer predicciones del período de prueba
            y_pred = prediccion['yhat'].iloc[split_idx:].values
            y_test = test_prophet['y'].values
            
            return self.calcular_metricas(y_test, y_pred, 'Prophet', sensor,
                                        tiempo_entrenamiento, tiempo_prediccion)
            
        except Exception as e:
            print(f"❌ Error Prophet {sensor}: {e}")
            return None
    
    def modelo_lstm(self, sensor):
        """Modelo LSTM para predicción 24h"""
        print(f"🔄 Entrenando LSTM - {sensor}")
        
        try:
            X_train, X_test, y_train, y_test, seq_length = self.preparar_datos_24h(sensor)
            
            # Normalizar datos
            scaler_X = MinMaxScaler()
            scaler_y = MinMaxScaler()
            
            X_train_scaled = scaler_X.fit_transform(X_train)
            X_test_scaled = scaler_X.transform(X_test)
            
            y_train_scaled = scaler_y.fit_transform(y_train.reshape(-1, 1)).flatten()
            
            # Reshape para LSTM
            X_train_lstm = X_train_scaled.reshape(X_train_scaled.shape[0], X_train_scaled.shape[1], 1)
            X_test_lstm = X_test_scaled.reshape(X_test_scaled.shape[0], X_test_scaled.shape[1], 1)
            
            # Modelo LSTM simple
            modelo = Sequential([
                LSTM(50, return_sequences=True, input_shape=(seq_length, 1)),
                Dropout(0.2),
                LSTM(50, return_sequences=False),
                Dropout(0.2),
                Dense(1)
            ])
            
            modelo.compile(optimizer='adam', loss='mse', metrics=['mae'])
            
            # Medir tiempo de entrenamiento
            tiempo_inicio_entrenamiento = time.time()
            
            # Entrenar
            early_stop = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
            
            modelo.fit(
                X_train_lstm, y_train_scaled,
                epochs=50,
                batch_size=32,
                validation_split=0.2,
                callbacks=[early_stop],
                verbose=0
            )
            
            tiempo_entrenamiento = time.time() - tiempo_inicio_entrenamiento
            
            # Medir tiempo de predicción
            tiempo_inicio_prediccion = time.time()
            y_pred_scaled = modelo.predict(X_test_lstm, verbose=0)
            tiempo_prediccion = time.time() - tiempo_inicio_prediccion
            
            y_pred = scaler_y.inverse_transform(y_pred_scaled).flatten()
            
            return self.calcular_metricas(y_test, y_pred, 'LSTM', sensor,
                                        tiempo_entrenamiento, tiempo_prediccion)
            
        except Exception as e:
            print(f"❌ Error LSTM {sensor}: {e}")
            return None
    
    def modelo_perceptron(self, sensor):
        """Modelo Perceptron para predicción 24h"""
        print(f"🔄 Entrenando Perceptron - {sensor}")
        
        try:
            X_train, X_test, y_train, y_test, _ = self.preparar_datos_24h(sensor)
            
            # Normalizar
            scaler_X = MinMaxScaler()
            scaler_y = MinMaxScaler()
            
            X_train_scaled = scaler_X.fit_transform(X_train)
            X_test_scaled = scaler_X.transform(X_test)
            
            y_train_scaled = scaler_y.fit_transform(y_train.reshape(-1, 1)).flatten()
            
            # Medir tiempo de entrenamiento
            tiempo_inicio_entrenamiento = time.time()
            
            # Modelo MLP
            modelo = MLPRegressor(
                hidden_layer_sizes=(100, 50),
                activation='relu',
                solver='adam',
                max_iter=500,
                random_state=42,
                early_stopping=True,
                validation_fraction=0.2
            )
            
            modelo.fit(X_train_scaled, y_train_scaled)
            
            tiempo_entrenamiento = time.time() - tiempo_inicio_entrenamiento
            
            # Medir tiempo de predicción
            tiempo_inicio_prediccion = time.time()
            y_pred_scaled = modelo.predict(X_test_scaled)
            tiempo_prediccion = time.time() - tiempo_inicio_prediccion
            
            y_pred = scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()
            
            return self.calcular_metricas(y_test, y_pred, 'Perceptron', sensor,
                                        tiempo_entrenamiento, tiempo_prediccion)
            
        except Exception as e:
            print(f"❌ Error Perceptron {sensor}: {e}")
            return None
    
    def ejecutar_analisis_completo(self):
        """Ejecutar análisis completo y generar reporte"""
        print("🚀 CIMARQ - Análisis Predictivo 24h")
        print("=" * 50)
        
        # Cargar datos
        if not self.cargar_datos():
            return False
        
        # Sensores a analizar
        sensores = ['temperatura', 'ph', 'oxigeno']
        
        # Modelos a probar
        modelos = [
            ('ARIMA', self.modelo_arima),
            ('SARIMA', self.modelo_sarima),
            ('LSTM', self.modelo_lstm),
            ('Perceptron', self.modelo_perceptron),
        ]
        
        if PROPHET_AVAILABLE:
            modelos.append(('Prophet', self.modelo_prophet))
        
        print(f"\n🎯 Evaluando {len(modelos)} modelos en {len(sensores)} sensores...")
        print("📊 Horizonte de predicción: 24 horas")
        
        # Ejecutar todos los modelos
        todos_resultados = []
        
        for sensor in sensores:
            print(f"\n🌡️ Analizando sensor: {sensor.upper()}")
            print("-" * 30)
            
            for nombre_modelo, funcion_modelo in modelos:
                resultado = funcion_modelo(sensor)
                if resultado:
                    todos_resultados.append(resultado)
                    tiempo_total = resultado['tiempo_total']
                    print(f"✅ {nombre_modelo}: MAE={resultado['MAE']:.3f}, RMSE={resultado['RMSE']:.3f}, R²={resultado['R2']:.3f}, ⏱️{tiempo_total:.2f}s")
        
        # Guardar y analizar resultados
        self.guardar_resultados(todos_resultados)
        self.generar_reporte_comparativo(todos_resultados)
        self.generar_graficos(todos_resultados)
        
        return True
    
    def guardar_resultados(self, resultados):
        """Guardar resultados en JSON"""
        
        # Agregar metadata
        metadata = {
            'fecha_analisis': datetime.now().isoformat(),
            'dataset': self.csv_path,
            'horizonte_prediccion': '24 horas',
            'total_registros': len(self.df) if self.df is not None else 0,
            'sensores_analizados': ['temperatura', 'ph', 'oxigeno'],
            'metricas': ['MAE', 'RMSE', 'R2', 'MAPE', 'tiempo_entrenamiento', 'tiempo_prediccion', 'tiempo_total', 'score_eficiencia']
        }
        
        salida = {
            'metadata': metadata,
            'resultados': resultados
        }
        
        # Guardar JSON
        archivo_json = f"resultados/analisis_predictivo_24h_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(archivo_json, 'w', encoding='utf-8') as f:
            json.dump(salida, f, indent=2, ensure_ascii=False)
            
        print(f"💾 Resultados guardados: {archivo_json}")
    
    def generar_reporte_comparativo(self, resultados):
        """Generar reporte de comparación entre modelos"""
        
        if not resultados:
            print("❌ No hay resultados para generar reporte")
            return
        
        # Convertir a DataFrame
        df_resultados = pd.DataFrame(resultados)
        
        archivo_reporte = f"resultados/reporte_comparativo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        with open(archivo_reporte, 'w', encoding='utf-8') as f:
            f.write("🐟 CIMARQ - REPORTE COMPARATIVO DE MODELOS ML\n")
            f.write("=" * 60 + "\n")
            f.write(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"🎯 Horizonte: 24 horas\n")
            f.write(f"📊 Dataset: {self.csv_path}\n\n")
            
            # Resumen por sensor
            for sensor in df_resultados['sensor'].unique():
                f.write(f"🌡️ SENSOR: {sensor.upper()}\n")
                f.write("-" * 40 + "\n")
                
                sensor_data = df_resultados[df_resultados['sensor'] == sensor]
                
                # Ordenar por R² (descendente) y MAE (ascendente)
                sensor_data_sorted = sensor_data.sort_values(['R2', 'MAE'], ascending=[False, True])
                
                f.write("🏆 RANKING DE MODELOS (Precisión → Peor):\n")
                for i, (_, row) in enumerate(sensor_data_sorted.iterrows(), 1):
                    tiempo_total = row['tiempo_total']
                    f.write(f"{i}. {row['modelo']:<12} | R²={row['R2']:.3f} | MAE={row['MAE']:.3f} | RMSE={row['RMSE']:.3f} | ⏱️{tiempo_total:.2f}s\n")
                
                # Análisis de tiempos por sensor
                f.write(f"\n⏱️ ANÁLISIS DE TIEMPOS ({sensor.upper()}):\n")
                sensor_time_sorted = sensor_data.sort_values('tiempo_total')
                for i, (_, row) in enumerate(sensor_time_sorted.iterrows(), 1):
                    entrenamiento = row['tiempo_entrenamiento']
                    prediccion = row['tiempo_prediccion'] 
                    total = row['tiempo_total']
                    eficiencia = row['score_eficiencia']
                    f.write(f"{i}. {row['modelo']:<12} | Entren:{entrenamiento:.2f}s | Pred:{prediccion:.3f}s | Total:{total:.2f}s | Efic:{eficiencia:.4f}\n")
                
                # Mejor modelo para este sensor (precisión vs tiempo)
                mejor_modelo = sensor_data_sorted.iloc[0]
                mas_rapido = sensor_time_sorted.iloc[0]
                f.write(f"\n✅ MEJOR PRECISIÓN: {mejor_modelo['modelo']} (R²={mejor_modelo['R2']:.3f}, {mejor_modelo['tiempo_total']:.2f}s)\n")
                f.write(f"⚡ MÁS RÁPIDO: {mas_rapido['modelo']} ({mas_rapido['tiempo_total']:.2f}s, R²={mas_rapido['R2']:.3f})\n")
                
                # Interpretación
                if mejor_modelo['R2'] >= 0.8:
                    calidad = "EXCELENTE 🟢"
                elif mejor_modelo['R2'] >= 0.6:
                    calidad = "BUENA 🟡"
                else:
                    calidad = "REGULAR 🟠"
                
                # Clasificar velocidad
                tiempo_mejor = mejor_modelo['tiempo_total']
                if tiempo_mejor <= 1:
                    velocidad = "MUY RÁPIDO ⚡"
                elif tiempo_mejor <= 5:
                    velocidad = "RÁPIDO 🟢"
                elif tiempo_mejor <= 15:
                    velocidad = "MODERADO 🟡"
                else:
                    velocidad = "LENTO 🟠"
                    
                f.write(f"📈 Calidad: {calidad} | ⏱️ Velocidad: {velocidad}\n\n")
            
            # Resumen global
            f.write("🎯 RECOMENDACIONES FINALES\n")
            f.write("=" * 30 + "\n")
            
            # Mejor modelo por sensor
            for sensor in df_resultados['sensor'].unique():
                sensor_data = df_resultados[df_resultados['sensor'] == sensor]
                mejor = sensor_data.loc[sensor_data['R2'].idxmax()]
                f.write(f"• {sensor.title()}: {mejor['modelo']} (R²={mejor['R2']:.3f})\n")
            
            # Modelo más consistente
            modelo_promedio = df_resultados.groupby('modelo')['R2'].mean().sort_values(ascending=False)
            f.write(f"\n🏅 Modelo más consistente: {modelo_promedio.index[0]} (R² promedio: {modelo_promedio.iloc[0]:.3f})\n")
            
            # Análisis global de tiempos
            f.write(f"\n⚡ ANÁLISIS GLOBAL DE RENDIMIENTO\n")
            f.write("=" * 40 + "\n")
            
            # Tiempos promedio por modelo
            tiempos_modelo = df_resultados.groupby('modelo').agg({
                'tiempo_entrenamiento': 'mean',
                'tiempo_prediccion': 'mean', 
                'tiempo_total': 'mean',
                'score_eficiencia': 'mean',
                'R2': 'mean'
            }).round(3)
            
            f.write("🔥 RANKING POR EFICIENCIA (R² / Tiempo):\n")
            eficiencia_ranking = tiempos_modelo.sort_values('score_eficiencia', ascending=False)
            for i, (modelo, stats) in enumerate(eficiencia_ranking.iterrows(), 1):
                f.write(f"{i}. {modelo:<12} | Efic:{stats['score_eficiencia']:.4f} | R²:{stats['R2']:.3f} | Tiempo:{stats['tiempo_total']:.2f}s\n")
            
            f.write(f"\n⏱️ RANKING POR VELOCIDAD:\n")
            velocidad_ranking = tiempos_modelo.sort_values('tiempo_total')
            for i, (modelo, stats) in enumerate(velocidad_ranking.iterrows(), 1):
                f.write(f"{i}. {modelo:<12} | {stats['tiempo_total']:.2f}s | R²:{stats['R2']:.3f} | Efic:{stats['score_eficiencia']:.4f}\n")
            
            # Recomendaciones por caso de uso
            f.write(f"\n🎯 RECOMENDACIONES POR CASO DE USO:\n")
            mejor_precision = modelo_promedio.index[0]
            mas_rapido = velocidad_ranking.index[0]
            mas_eficiente = eficiencia_ranking.index[0]
            
            f.write(f"• 🎯 Máxima precisión: {mejor_precision}\n")
            f.write(f"• ⚡ Tiempo real crítico: {mas_rapido}\n")
            f.write(f"• ⚖️ Balance precisión/velocidad: {mas_eficiente}\n")
            f.write(f"• 🔋 IoT con recursos limitados: {mas_rapido}\n")
            f.write(f"• 🏭 Producción industrial: {mas_eficiente}\n")
            
            f.write("\n" + "=" * 60 + "\n")
            f.write("📋 MÉTRICAS EXPLICADAS:\n")
            f.write("• R² (0-1): Porcentaje de varianza explicada. >0.8=Excelente, >0.6=Bueno\n")
            f.write("• MAE: Error absoluto promedio (unidades originales)\n")
            f.write("• RMSE: Error cuadrático (penaliza errores grandes)\n")
            f.write("• MAPE: Error porcentual promedio\n")
            f.write("• Tiempo Entrenamiento: Tiempo para ajustar el modelo\n")
            f.write("• Tiempo Predicción: Tiempo para generar 24h de predicciones\n")
            f.write("• Score Eficiencia: R² dividido por tiempo total (mayor = mejor)\n")
            f.write("• ⚡<1s=Muy Rápido, 🟢1-5s=Rápido, 🟡5-15s=Moderado, 🟠>15s=Lento\n")
        
        print(f"📋 Reporte generado: {archivo_reporte}")
        
        # Mostrar resumen en consola
        print("\n🏆 RESUMEN EJECUTIVO:")
        print("=" * 50)
        for sensor in df_resultados['sensor'].unique():
            sensor_data = df_resultados[df_resultados['sensor'] == sensor]
            mejor = sensor_data.loc[sensor_data['R2'].idxmax()]
            mas_rapido = sensor_data.loc[sensor_data['tiempo_total'].idxmin()]
            print(f"🌡️ {sensor.title()}:")
            print(f"   🎯 Mejor: {mejor['modelo']} (R²={mejor['R2']:.3f}, {mejor['tiempo_total']:.2f}s)")
            print(f"   ⚡ Rápido: {mas_rapido['modelo']} ({mas_rapido['tiempo_total']:.2f}s, R²={mas_rapido['R2']:.3f})")
        
        # Resumen global de eficiencia
        tiempos_globales = df_resultados.groupby('modelo').agg({
            'score_eficiencia': 'mean',
            'tiempo_total': 'mean',
            'R2': 'mean'
        }).round(3)
        
        mejor_eficiencia = tiempos_globales['score_eficiencia'].idxmax()
        print(f"\n⚖️ Mejor balance global: {mejor_eficiencia} (Eficiencia: {tiempos_globales.loc[mejor_eficiencia, 'score_eficiencia']:.4f})")
    
    def generar_graficos(self, resultados):
        """Generar gráficos comparativos"""
        
        if not resultados:
            return
        
        df_resultados = pd.DataFrame(resultados)
        
        # Configurar estilo
        plt.style.use('default')
        sns.set_palette("husl")
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle('🐟 CIMARQ - Comparación Modelos ML (Predicción 24h)', fontsize=16, fontweight='bold')
        
        # 1. R² por modelo y sensor
        ax1 = axes[0, 0]
        df_pivot = df_resultados.pivot(index='sensor', columns='modelo', values='R2')
        sns.heatmap(df_pivot, annot=True, fmt='.3f', cmap='RdYlGn', ax=ax1, cbar_kws={'label': 'R²'})
        ax1.set_title('R² por Modelo y Sensor')
        ax1.set_xlabel('Modelo')
        ax1.set_ylabel('Sensor')
        
        # 2. MAE por modelo
        ax2 = axes[0, 1]
        df_resultados.boxplot(column='MAE', by='modelo', ax=ax2)
        ax2.set_title('Distribución MAE por Modelo')
        ax2.set_xlabel('Modelo')
        ax2.set_ylabel('MAE')
        plt.setp(ax2.xaxis.get_majorticklabels(), rotation=45)
        
        # 3. Ranking por sensor
        ax3 = axes[1, 0]
        for sensor in df_resultados['sensor'].unique():
            sensor_data = df_resultados[df_resultados['sensor'] == sensor]
            ax3.bar([f"{row['modelo']}_{sensor}" for _, row in sensor_data.iterrows()], 
                   sensor_data['R2'], label=sensor, alpha=0.7)
        ax3.set_title('R² por Modelo y Sensor')
        ax3.set_ylabel('R²')
        ax3.legend()
        plt.setp(ax3.xaxis.get_majorticklabels(), rotation=45)
        
        # 4. Resumen de métricas
        ax4 = axes[1, 1]
        metricas_promedio = df_resultados.groupby('modelo')[['MAE', 'RMSE', 'R2']].mean()
        metricas_promedio.plot(kind='bar', ax=ax4)
        ax4.set_title('Métricas Promedio por Modelo')
        ax4.set_ylabel('Valor')
        ax4.legend()
        plt.setp(ax4.xaxis.get_majorticklabels(), rotation=45)
        
        plt.tight_layout()
        
        # Guardar gráfico
        archivo_grafico = f"resultados/graficos_comparativos_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        plt.savefig(archivo_grafico, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"📊 Gráficos guardados: {archivo_grafico}")

def main():
    """Función principal"""
    predictor = PredictorSensores24h()
    
    print("🐟 Iniciando análisis predictivo CIMARQ...")
    
    if predictor.ejecutar_analisis_completo():
        print("\n✅ Análisis completado exitosamente")
        print("📁 Revisa la carpeta 'resultados' para ver:")
        print("   • Datos JSON completos")  
        print("   • Reporte comparativo de texto")
        print("   • Gráficos de comparación")
        print("\n🎯 Usa el reporte para elegir el mejor modelo para cada sensor")
    else:
        print("❌ Error en el análisis")

if __name__ == "__main__":
    main()
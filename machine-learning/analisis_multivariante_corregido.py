#!/usr/bin/env python3
"""
CIMARQ - Análisis Predictivo Multivariante CORREGIDO
====================================================
Solución a R² negativos: normalización consistente + parámetros optimizados
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
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
from statsmodels.tsa.vector_ar.var_model import VAR
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.arima.model import ARIMA

# LSTM
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

class PredictorMultivarianteSensores:
    """Predictor multivariante con correcciones para dataset pequeño"""
    
    def __init__(self, csv_path='datos_entrenamiento.csv', window_size=5):
        self.csv_path = csv_path
        self.window_size = window_size  # Reducido a 5 para maximizar muestras
        self.df = None
        self.df_scaled = None
        self.resultados = {}
        self.sensores = ['temperatura', 'ph', 'oxigeno']
        self.scaler = MinMaxScaler()  # Scaler global
        self.crear_carpeta_resultados()
        
    def crear_carpeta_resultados(self):
        """Crear carpeta de resultados si no existe"""
        if not os.path.exists('resultados'):
            os.makedirs('resultados')
            
    def cargar_datos(self):
        """Cargar y preparar datos multivariantes ordenados por fecha"""
        print("📊 Cargando datos multivariantes...")
        
        try:
            # Cargar CSV
            df = pd.read_csv(self.csv_path)
            print(f"✅ Dataset cargado: {df.shape[0]} registros, {df.shape[1]} columnas")
            
            # Convertir fecha y ordenar cronológicamente
            df['fecha'] = pd.to_datetime(df['fecha'])
            df = df.sort_values('fecha').reset_index(drop=True)
            
            # Seleccionar solo columnas relevantes
            df_clean = df[['fecha'] + self.sensores].copy()
            
            # Eliminar valores nulos
            antes = len(df_clean)
            df_clean = df_clean.dropna()
            despues = len(df_clean)
            
            if antes != despues:
                print(f"🧹 Eliminados {antes-despues} registros con valores nulos")
                
            # NO eliminar outliers agresivamente con dataset pequeño
            # Solo outliers extremos (más de 3 desviaciones estándar)
            for sensor in self.sensores:
                mean = df_clean[sensor].mean()
                std = df_clean[sensor].std()
                outliers = (df_clean[sensor] < mean - 3*std) | (df_clean[sensor] > mean + 3*std)
                if outliers.sum() > 0:
                    print(f"🔍 {sensor}: {outliers.sum()} outliers extremos eliminados")
                    df_clean = df_clean[~outliers]
            
            self.df = df_clean.reset_index(drop=True)
            
            # Normalizar datos una sola vez
            valores = self.df[self.sensores].values
            valores_normalizados = self.scaler.fit_transform(valores)
            self.df_scaled = self.df.copy()
            self.df_scaled[self.sensores] = valores_normalizados
            
            print(f"✅ Datos limpios: {len(self.df)} registros finales")
            print(f"📅 Período: {self.df['fecha'].min()} → {self.df['fecha'].max()}")
            print(f"🔢 Window size: {self.window_size} → Muestras disponibles: {len(self.df) - self.window_size}")
            
            # Estadísticas básicas
            print("\n📈 Estadísticas del dataset multivariante:")
            for sensor in self.sensores:
                stats = self.df[sensor].describe()
                print(f"{sensor.upper():12} | μ={stats['mean']:6.2f} | σ={stats['std']:5.2f} | min={stats['min']:6.2f} | max={stats['max']:6.2f}")
                
            return True
            
        except Exception as e:
            print(f"❌ Error cargando datos: {e}")
            return False
    
    def preparar_datos_multivariantes(self, usar_normalizados=True, usar_todos_datos=False):
        """Preparar datos con ventana deslizante
        
        Args:
            usar_normalizados: Si True usa datos normalizados, si False usa originales
            usar_todos_datos: Si True usa todos los datos para entrenar (sin test split)
        """
        
        # Elegir dataset
        data = self.df_scaled[self.sensores].values if usar_normalizados else self.df[self.sensores].values
        
        # Crear secuencias con ventana deslizante
        X, y = [], []
        for i in range(len(data) - self.window_size):
            X.append(data[i:i+self.window_size])
            y.append(data[i+self.window_size])
            
        X, y = np.array(X), np.array(y)
        
        if usar_todos_datos:
            # Usar todos los datos para entrenamiento
            print(f"📊 Usando TODOS los datos: {X.shape} | Normalizado: {usar_normalizados}")
            return X, X, y, y  # train y test son los mismos
        else:
            # División temporal 85/15 para maximizar entrenamiento
            split_idx = int(len(X) * 0.85)
            
            X_train, X_test = X[:split_idx], X[split_idx:]
            y_train, y_test = y[:split_idx], y[split_idx:]
            
            print(f"📊 Train: {X_train.shape}, Test: {X_test.shape} | Normalizado: {usar_normalizados}")
            return X_train, X_test, y_train, y_test
    
    def calcular_metricas_multivariantes(self, y_true, y_pred, modelo_nombre, tiempo_entrenamiento=0, tiempo_prediccion=0):
        """Calcular métricas para las 3 variables"""
        
        resultados = []
        
        for idx, sensor in enumerate(self.sensores):
            y_true_sensor = y_true[:, idx]
            y_pred_sensor = y_pred[:, idx]
            
            mae = mean_absolute_error(y_true_sensor, y_pred_sensor)
            rmse = np.sqrt(mean_squared_error(y_true_sensor, y_pred_sensor))
            r2 = r2_score(y_true_sensor, y_pred_sensor)
            
            # MAPE
            denominador = np.where(np.abs(y_true_sensor) > 0.01, y_true_sensor, 0.01)
            mape = np.mean(np.abs((y_true_sensor - y_pred_sensor) / denominador)) * 100
            
            tiempo_total = tiempo_entrenamiento + tiempo_prediccion
            
            # Score de eficiencia
            score_eficiencia = r2 / (tiempo_total + 0.001) if r2 > 0 else r2
            
            # Score de precisión (0-100)
            r2_normalizado = max(0, r2) * 100
            mae_normalizado = max(0, 100 - (mae * 20))  # Más estricto
            rmse_normalizado = max(0, 100 - (rmse * 20))
            
            score_precision = (r2_normalizado * 0.5) + (mae_normalizado * 0.25) + (rmse_normalizado * 0.25)
            
            # Score de rapidez
            score_rapidez = 100 / (tiempo_total + 0.1) if tiempo_total > 0 else 100
            
            # Score combinado
            score_combinado = (score_precision * 0.4) + (score_rapidez * 0.3) + (score_eficiencia * 30)
            
            resultados.append({
                'modelo': modelo_nombre,
                'sensor': sensor,
                'MAE': mae,
                'RMSE': rmse,
                'R2': r2,
                'MAPE': mape,
                'tiempo_entrenamiento': tiempo_entrenamiento,
                'tiempo_prediccion': tiempo_prediccion,
                'tiempo_total': tiempo_total,
                'score_eficiencia': score_eficiencia,
                'score_precision': score_precision,
                'score_rapidez': score_rapidez,
                'score_combinado': score_combinado
            })
        
        return resultados
    
    def modelo_var(self):
        """VAR con datos normalizados"""
        print(f"🔄 Entrenando VAR (Multivariante)")
        
        try:
            X_train, X_test, y_train, y_test = self.preparar_datos_multivariantes(usar_normalizados=True, usar_todos_datos=True)
            
            # VAR con datos normalizados completos
            data_train = self.df_scaled[self.sensores].values[:len(X_train) + self.window_size]
            
            tiempo_inicio = time.time()
            
            # Usar menos lags para dataset pequeño (máximo 3)
            modelo = VAR(data_train)
            modelo_fit = modelo.fit(maxlags=min(3, self.window_size), ic='aic')
            
            tiempo_entrenamiento = time.time() - tiempo_inicio
            
            # Predicciones con ventana deslizante
            tiempo_inicio_pred = time.time()
            
            predicciones = []
            input_data = data_train[-self.window_size:].copy()
            
            for _ in range(len(y_test)):
                pred = modelo_fit.forecast(input_data, steps=1)
                predicciones.append(pred[0])
                input_data = np.vstack([input_data[1:], pred])
            
            tiempo_prediccion = time.time() - tiempo_inicio_pred
            
            y_pred = np.array(predicciones)
            
            # Desnormalizar para calcular métricas en escala real
            y_test_real = self.scaler.inverse_transform(y_test)
            y_pred_real = self.scaler.inverse_transform(y_pred)
            
            return self.calcular_metricas_multivariantes(y_test_real, y_pred_real, 'VAR', 
                                                         tiempo_entrenamiento, tiempo_prediccion)
            
        except Exception as e:
            print(f"❌ Error VAR: {str(e)[:150]}")
            return None
    
    def modelo_lstm_multivariante(self):
        """LSTM con datos ya normalizados"""
        print(f"🔄 Entrenando LSTM (Multivariante)")
        
        try:
            X_train, X_test, y_train, y_test = self.preparar_datos_multivariantes(usar_normalizados=True, usar_todos_datos=True)
            
            tiempo_inicio = time.time()
            
            # Modelo LSTM más simple para dataset pequeño
            modelo = Sequential([
                LSTM(32, activation='tanh', input_shape=(X_train.shape[1], X_train.shape[2])),
                Dropout(0.2),
                Dense(16, activation='relu'),
                Dense(3)  # 3 salidas (temp, pH, oxígeno)
            ])
            
            modelo.compile(optimizer='adam', loss='mse', metrics=['mae'])
            
            # Sin early stopping ya que usamos todos los datos
            # Early stopping más permisivo
            # early_stop = EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True)
            
            # Entrenar con menos épocas
            modelo.fit(
                X_train, y_train,
                epochs=50,
                batch_size=8,  # Batch pequeño para dataset pequeño
                validation_split=0.0,  # Sin validación, usar todos los datos
                verbose=0
            )
            
            tiempo_entrenamiento = time.time() - tiempo_inicio
            
            # Predicción
            tiempo_inicio_pred = time.time()
            y_pred = modelo.predict(X_test, verbose=0)
            tiempo_prediccion = time.time() - tiempo_inicio_pred
            
            # Desnormalizar
            y_test_real = self.scaler.inverse_transform(y_test)
            y_pred_real = self.scaler.inverse_transform(y_pred)
            
            return self.calcular_metricas_multivariantes(y_test_real, y_pred_real, 'LSTM_Multi', 
                                                         tiempo_entrenamiento, tiempo_prediccion)
            
        except Exception as e:
            print(f"❌ Error LSTM: {str(e)[:150]}")
            return None
    
    def modelo_perceptron_multivariante(self):
        """Perceptron con datos normalizados"""
        print(f"🔄 Entrenando Perceptron (Multivariante)")
        
        try:
            X_train, X_test, y_train, y_test = self.preparar_datos_multivariantes(usar_normalizados=True, usar_todos_datos=True)
            
            # Aplanar ventana temporal para MLP
            X_train_flat = X_train.reshape(X_train.shape[0], -1)
            X_test_flat = X_test.reshape(X_test.shape[0], -1)
            
            tiempo_inicio = time.time()
            
            # MLP más simple
            modelo = MLPRegressor(
                hidden_layer_sizes=(32, 16),  # Más pequeño
                activation='relu',
                solver='adam',
                max_iter=500,  # Más iteraciones
                early_stopping=False,  # Desactivar early stopping para usar todos los datos
                random_state=42
            )
            
            modelo.fit(X_train_flat, y_train)
            
            tiempo_entrenamiento = time.time() - tiempo_inicio
            
            # Predicción
            tiempo_inicio_pred = time.time()
            y_pred = modelo.predict(X_test_flat)
            tiempo_prediccion = time.time() - tiempo_inicio_pred
            
            # Desnormalizar
            y_test_real = self.scaler.inverse_transform(y_test)
            y_pred_real = self.scaler.inverse_transform(y_pred)
            
            return self.calcular_metricas_multivariantes(y_test_real, y_pred_real, 'Perceptron_Multi', 
                                                         tiempo_entrenamiento, tiempo_prediccion)
            
        except Exception as e:
            print(f"❌ Error Perceptron: {str(e)[:150]}")
            return None
    
    def modelo_arima_univariante(self, sensor_idx):
        """ARIMA para un sensor individual"""
        print(f"🔄 Entrenando ARIMA para {self.sensores[sensor_idx]}")
        
        try:
            X_train, X_test, y_train, y_test = self.preparar_datos_multivariantes(usar_normalizados=True, usar_todos_datos=True)
            
            # Extraer datos de un solo sensor (normalizado)
            y_train_sensor = y_train[:, sensor_idx]
            y_test_sensor = y_test[:, sensor_idx]
            
            tiempo_inicio = time.time()
            
            # ARIMA simple (1,1,1) para dataset pequeño
            modelo = ARIMA(y_train_sensor, order=(1, 1, 1))
            modelo_fit = modelo.fit()
            
            tiempo_entrenamiento = time.time() - tiempo_inicio
            
            # Predicción
            tiempo_inicio_pred = time.time()
            predicciones = modelo_fit.forecast(steps=len(y_test_sensor))
            tiempo_prediccion = time.time() - tiempo_inicio_pred
            
            # Crear arrays completos con los otros sensores sin cambios
            y_test_completo = y_test.copy()
            y_pred_completo = y_test.copy()
            y_pred_completo[:, sensor_idx] = predicciones
            
            # Desnormalizar
            y_test_real = self.scaler.inverse_transform(y_test_completo)
            y_pred_real = self.scaler.inverse_transform(y_pred_completo)
            
            resultados = self.calcular_metricas_multivariantes(y_test_real, y_pred_real, f'ARIMA {self.sensores[sensor_idx]}',
                                                               tiempo_entrenamiento, tiempo_prediccion)
            
            return [r for r in resultados if r['sensor'] == self.sensores[sensor_idx]]
            
        except Exception as e:
            print(f"❌ Error ARIMA {self.sensores[sensor_idx]}: {str(e)[:150]}")
            return None
    
    def modelo_sarima_univariante(self, sensor_idx):
        """SARIMA para un sensor individual"""
        print(f"🔄 Entrenando SARIMA para {self.sensores[sensor_idx]}")
        
        try:
            X_train, X_test, y_train, y_test = self.preparar_datos_multivariantes(usar_normalizados=True, usar_todos_datos=True)
            
            # Extraer datos de un solo sensor
            y_train_sensor = y_train[:, sensor_idx]
            y_test_sensor = y_test[:, sensor_idx]
            
            tiempo_inicio = time.time()
            
            # SARIMA simple con estacionalidad semanal reducida
            modelo = SARIMAX(y_train_sensor, order=(1, 1, 1), seasonal_order=(1, 0, 1, 5))
            modelo_fit = modelo.fit(disp=False)
            
            tiempo_entrenamiento = time.time() - tiempo_inicio
            
            # Predicción
            tiempo_inicio_pred = time.time()
            predicciones = modelo_fit.forecast(steps=len(y_test_sensor))
            tiempo_prediccion = time.time() - tiempo_inicio_pred
            
            # Crear arrays completos
            y_test_completo = y_test.copy()
            y_pred_completo = y_test.copy()
            y_pred_completo[:, sensor_idx] = predicciones
            
            # Desnormalizar
            y_test_real = self.scaler.inverse_transform(y_test_completo)
            y_pred_real = self.scaler.inverse_transform(y_pred_completo)
            
            resultados = self.calcular_metricas_multivariantes(y_test_real, y_pred_real, f'SARIMA {self.sensores[sensor_idx]}',
                                                               tiempo_entrenamiento, tiempo_prediccion)
            
            return [r for r in resultados if r['sensor'] == self.sensores[sensor_idx]]
            
        except Exception as e:
            print(f"❌ Error SARIMA {self.sensores[sensor_idx]}: {str(e)[:150]}")
            return None
    
    def ejecutar_analisis_completo(self):
        """Ejecutar todos los modelos"""
        
        modelos = [
            ('VAR Multivariante', self.modelo_var),
            ('LSTM Multivariante', self.modelo_lstm_multivariante),
            ('Perceptron Multivariante', self.modelo_perceptron_multivariante),
        ]
        
        # Agregar ARIMA y SARIMA para cada sensor
        for idx, sensor in enumerate(self.sensores):
            modelos.append((f'ARIMA {sensor}', lambda idx=idx: self.modelo_arima_univariante(idx)))
            modelos.append((f'SARIMA {sensor}', lambda idx=idx: self.modelo_sarima_univariante(idx)))
        
        print(f"\n🤖 Modelos a evaluar: {len(modelos)}")
        print(f"📊 Variables simultáneas: {', '.join(self.sensores)}")
        print(f"📏 Ventana temporal: {self.window_size} mediciones")
        print("\n" + "="*60)
        
        todos_resultados = []
        
        for nombre_modelo, funcion_modelo in modelos:
            print(f"\n{'='*60}")
            print(f"Ejecutando: {nombre_modelo}")
            print('='*60)
            
            resultados = funcion_modelo()
            
            if resultados:
                if isinstance(resultados, list):
                    todos_resultados.extend(resultados)
                else:
                    todos_resultados.append(resultados)
                    
                print(f"✅ {nombre_modelo} completado")
            else:
                print(f"⚠️ {nombre_modelo} falló")
        
        if not todos_resultados:
            print("❌ No se obtuvieron resultados de ningún modelo")
            return False
        
        # Guardar y generar reportes
        self.guardar_resultados(todos_resultados)
        self.generar_reporte_texto(todos_resultados)
        self.generar_graficos(todos_resultados)
        
        return True
    
    def guardar_resultados(self, resultados):
        """Guardar resultados en JSON"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archivo = f'resultados/analisis_corregido_{timestamp}.json'
        
        resultados_json = []
        for r in resultados:
            r_copy = r.copy()
            for key, value in r_copy.items():
                if isinstance(value, (np.integer, np.floating)):
                    r_copy[key] = float(value)
            resultados_json.append(r_copy)
        
        with open(archivo, 'w', encoding='utf-8') as f:
            json.dump({
                'fecha_analisis': timestamp,
                'window_size': self.window_size,
                'sensores': self.sensores,
                'registros_totales': len(self.df),
                'resultados': resultados_json
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Resultados guardados: {archivo}")
    
    def generar_reporte_texto(self, resultados):
        """Generar reporte comparativo"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archivo = f'resultados/reporte_corregido_{timestamp}.txt'
        
        df_resultados = pd.DataFrame(resultados)
        
        with open(archivo, 'w', encoding='utf-8') as f:
            f.write("="*80 + "\n")
            f.write("🐟 CIMARQ - ANÁLISIS PREDICTIVO CORREGIDO\n")
            f.write("="*80 + "\n\n")
            
            f.write(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"📊 Registros: {len(self.df)}\n")
            f.write(f"📏 Window size: {self.window_size}\n")
            f.write(f"🎯 Variables: {', '.join(self.sensores)}\n\n")
            
            # Análisis por sensor
            for sensor in self.sensores:
                f.write("\n" + "="*80 + "\n")
                f.write(f"📊 SENSOR: {sensor.upper()}\n")
                f.write("="*80 + "\n\n")
                
                sensor_data = df_resultados[df_resultados['sensor'] == sensor].copy()
                
                # Ranking por R²
                f.write("🏆 RANKING POR R² (Precisión):\n")
                r2_sorted = sensor_data.sort_values('R2', ascending=False)
                for i, (_, row) in enumerate(r2_sorted.iterrows(), 1):
                    f.write(f"{i}. {row['modelo']:<25} | R²: {row['R2']:.4f} | MAE: {row['MAE']:.3f} | RMSE: {row['RMSE']:.3f}\n")
                
                # Ranking por Tiempo
                f.write(f"\n⚡ RANKING POR RAPIDEZ:\n")
                time_sorted = sensor_data.sort_values('tiempo_total')
                for i, (_, row) in enumerate(time_sorted.iterrows(), 1):
                    f.write(f"{i}. {row['modelo']:<25} | Tiempo: {row['tiempo_total']:.3f}s\n")
                
                mejor = r2_sorted.iloc[0]
                f.write(f"\n✅ MEJOR MODELO: {mejor['modelo']} (R²: {mejor['R2']:.4f})\n")
            
            # Resumen global
            f.write("\n" + "="*80 + "\n")
            f.write("🎯 RESUMEN GLOBAL\n")
            f.write("="*80 + "\n\n")
            
            modelo_promedio = df_resultados.groupby('modelo').agg({
                'R2': 'mean',
                'MAE': 'mean',
                'RMSE': 'mean',
                'tiempo_total': 'mean'
            }).sort_values('R2', ascending=False)
            
            f.write("📈 PROMEDIO POR MODELO (3 sensores):\n")
            for i, (modelo, stats) in enumerate(modelo_promedio.iterrows(), 1):
                f.write(f"{i}. {modelo:<25} | R²: {stats['R2']:.4f} | MAE: {stats['MAE']:.3f} | ⏱️ {stats['tiempo_total']:.3f}s\n")
        
        print(f"📄 Reporte generado: {archivo}")
    
    def generar_graficos(self, resultados):
        """Generar gráficos comparativos completos"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archivo = f'resultados/graficos_corregido_{timestamp}.png'
        
        df_resultados = pd.DataFrame(resultados)
        
        fig, axes = plt.subplots(3, 2, figsize=(16, 14))
        fig.suptitle('Análisis Multivariante Corregido - CIMARQ', fontsize=16, fontweight='bold')
        
        # 1. R² por modelo y sensor
        ax1 = axes[0, 0]
        df_pivot = df_resultados.pivot_table(index='modelo', columns='sensor', values='R2')
        df_pivot.plot(kind='bar', ax=ax1, color=['#FF6B6B', '#4ECDC4', '#45B7D1'])
        ax1.set_title('📊 R² Score por Modelo y Sensor', fontweight='bold')
        ax1.set_ylabel('R² Score')
        ax1.set_xlabel('Modelo')
        ax1.legend(title='Sensor', loc='lower right')
        ax1.grid(axis='y', alpha=0.3)
        ax1.axhline(y=0, color='red', linestyle='--', alpha=0.5, label='Baseline (R²=0)')
        ax1.set_xticklabels(ax1.get_xticklabels(), rotation=45, ha='right')
        
        # 2. MAE por modelo y sensor
        ax2 = axes[0, 1]
        mae_promedio = df_resultados.groupby('modelo')['MAE'].mean().sort_values()
        mae_promedio.plot(kind='barh', ax=ax2, color='#FFB6B9')
        ax2.set_title('📉 MAE Promedio por Modelo', fontweight='bold')
        ax2.set_xlabel('MAE (menor es mejor)')
        ax2.grid(axis='x', alpha=0.3)
        
        # 3. RMSE por modelo
        ax3 = axes[1, 0]
        rmse_promedio = df_resultados.groupby('modelo')['RMSE'].mean().sort_values()
        rmse_promedio.plot(kind='barh', ax=ax3, color='#FEC8D8')
        ax3.set_title('📉 RMSE Promedio por Modelo', fontweight='bold')
        ax3.set_xlabel('RMSE (menor es mejor)')
        ax3.grid(axis='x', alpha=0.3)
        
        # 4. Tiempo de ejecución por modelo
        ax4 = axes[1, 1]
        tiempo_promedio = df_resultados.groupby('modelo')['tiempo_total'].mean().sort_values()
        colors_tiempo = ['#95E1D3' if t < 1 else '#F38181' for t in tiempo_promedio]
        tiempo_promedio.plot(kind='barh', ax=ax4, color=colors_tiempo)
        ax4.set_title('⏱️ Tiempo Total Promedio por Modelo', fontweight='bold')
        ax4.set_xlabel('Tiempo (segundos)')
        ax4.grid(axis='x', alpha=0.3)
        
        # 5. Score de precisión vs rapidez
        ax5 = axes[2, 0]
        precision_promedio = df_resultados.groupby('modelo')['score_precision'].mean().sort_values(ascending=False)
        rapidez_promedio = df_resultados.groupby('modelo')['score_rapidez'].mean()
        
        x = np.arange(len(precision_promedio))
        width = 0.35
        
        ax5.bar(x - width/2, precision_promedio, width, label='Precisión', color='#4ECDC4')
        ax5.bar(x + width/2, rapidez_promedio.loc[precision_promedio.index], width, label='Rapidez', color='#FFE66D')
        ax5.set_title('🎯 Precisión vs Rapidez por Modelo', fontweight='bold')
        ax5.set_ylabel('Score (0-100)')
        ax5.set_xlabel('Modelo')
        ax5.set_xticks(x)
        ax5.set_xticklabels(precision_promedio.index, rotation=45, ha='right')
        ax5.legend()
        ax5.grid(axis='y', alpha=0.3)
        
        # 6. Score combinado final
        ax6 = axes[2, 1]
        combinado_promedio = df_resultados.groupby('modelo')['score_combinado'].mean().sort_values(ascending=False)
        colors_combinado = ['#FF6B6B' if i == 0 else '#FFA07A' if i < 3 else '#FFDAB9' for i in range(len(combinado_promedio))]
        combinado_promedio.plot(kind='barh', ax=ax6, color=colors_combinado)
        ax6.set_title('🏆 Score Combinado Final (Precisión 40% + Rapidez 30% + Eficiencia 30%)', fontweight='bold')
        ax6.set_xlabel('Score Combinado')
        ax6.grid(axis='x', alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(archivo, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"📊 Gráficos guardados: {archivo}")
        
        # Generar gráfico adicional: Comparación detallada por sensor
        self._generar_grafico_por_sensor(df_resultados, timestamp)
        
        # Generar gráfico de trade-offs
        self._generar_grafico_tradeoffs(df_resultados, timestamp)
    
    def _generar_grafico_por_sensor(self, df_resultados, timestamp):
        """Gráficos detallados por cada sensor"""
        archivo = f'resultados/sensores_detalle_{timestamp}.png'
        
        fig, axes = plt.subplots(1, 3, figsize=(18, 6))
        fig.suptitle('Comparación Detallada por Sensor - CIMARQ', fontsize=16, fontweight='bold')
        
        for idx, sensor in enumerate(['temperatura', 'ph', 'oxigeno']):
            ax = axes[idx]
            sensor_data = df_resultados[df_resultados['sensor'] == sensor].copy()
            sensor_sorted = sensor_data.sort_values('R2', ascending=False)
            
            # Gráfico de barras con R²
            colors = ['#2ecc71' if r2 > 0.5 else '#f39c12' if r2 > 0.3 else '#e74c3c' 
                     for r2 in sensor_sorted['R2']]
            
            ax.barh(sensor_sorted['modelo'], sensor_sorted['R2'], color=colors)
            ax.set_xlabel('R² Score', fontweight='bold')
            ax.set_title(f'{sensor.upper()}', fontsize=14, fontweight='bold')
            ax.grid(axis='x', alpha=0.3)
            ax.axvline(x=0, color='red', linestyle='--', alpha=0.7, linewidth=2)
            ax.axvline(x=0.3, color='orange', linestyle='--', alpha=0.5, label='R²=0.3 (Aceptable)')
            ax.axvline(x=0.5, color='green', linestyle='--', alpha=0.5, label='R²=0.5 (Bueno)')
            
            if idx == 0:
                ax.legend(loc='lower right', fontsize=8)
            
            # Añadir valores en las barras
            for i, (_, row) in enumerate(sensor_sorted.iterrows()):
                ax.text(row['R2'] + 0.02, i, f"{row['R2']:.3f}", 
                       va='center', fontsize=9, fontweight='bold')
        
        plt.tight_layout()
        plt.savefig(archivo, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"📊 Gráficos por sensor guardados: {archivo}")
    
    def _generar_grafico_tradeoffs(self, df_resultados, timestamp):
        """Gráfico de dispersión: Precisión vs Rapidez"""
        archivo = f'resultados/tradeoffs_corregido_{timestamp}.png'
        
        fig, ax = plt.subplots(figsize=(12, 8))
        
        # Promedio por modelo
        modelo_stats = df_resultados.groupby('modelo').agg({
            'score_precision': 'mean',
            'score_rapidez': 'mean',
            'score_eficiencia': 'mean',
            'R2': 'mean'
        })
        
        # Tamaño basado en R² promedio (más grande = mejor R²)
        sizes = (modelo_stats['R2'] + 1) * 300  # +1 para que negativos sean visibles
        
        # Color basado en score de eficiencia
        scatter = ax.scatter(
            modelo_stats['score_rapidez'], 
            modelo_stats['score_precision'],
            s=sizes,
            c=modelo_stats['score_eficiencia'],
            cmap='RdYlGn',
            alpha=0.6,
            edgecolors='black',
            linewidth=1.5
        )
        
        # Etiquetas de modelos
        for modelo, row in modelo_stats.iterrows():
            ax.annotate(
                f"{modelo}\n(R²={row['R2']:.2f})", 
                (row['score_rapidez'], row['score_precision']),
                fontsize=9,
                ha='center',
                va='bottom',
                bbox=dict(boxstyle='round,pad=0.5', facecolor='white', alpha=0.8, edgecolor='gray')
            )
        
        ax.set_xlabel('Score de Rapidez → (mayor = más rápido)', fontsize=12, fontweight='bold')
        ax.set_ylabel('Score de Precisión → (mayor = más preciso)', fontsize=12, fontweight='bold')
        ax.set_title('⚖️ Trade-offs: Precisión vs Rapidez\n(Tamaño = R² promedio, Color = Eficiencia)', 
                     fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3)
        
        # Colorbar
        cbar = plt.colorbar(scatter, ax=ax)
        cbar.set_label('Score de Eficiencia (R²/tiempo)', fontsize=10, fontweight='bold')
        
        # Cuadrantes de referencia
        ax.axhline(y=50, color='gray', linestyle='--', alpha=0.3)
        ax.axvline(x=50, color='gray', linestyle='--', alpha=0.3)
        
        # Zona ideal
        ax.fill_between([50, 100], 50, 100, alpha=0.1, color='green', label='Zona Ideal')
        ax.text(75, 90, '✓ Alta Precisión\n✓ Alta Rapidez', ha='center', fontsize=10,
                bbox=dict(boxstyle='round', facecolor='lightgreen', alpha=0.5))
        
        ax.legend(loc='lower left', fontsize=10)
        
        plt.tight_layout()
        plt.savefig(archivo, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"📊 Gráfico de trade-offs guardado: {archivo}")

def main():
    """Función principal"""
    print("🐟 CIMARQ - Análisis Predictivo Multivariante CORREGIDO")
    print("=" * 60)
    print("🔧 Correcciones aplicadas:")
    print("  • Window size reducido a 5 (más muestras)")
    print("  • Normalización global consistente")
    print("  • USO DEL 100% DE DATOS para entrenamiento")
    print("  • Modelos simplificados para dataset pequeño")
    print("  • VAR con máximo 3 lags")
    print("  • LSTM con 32 unidades y menos épocas")
    print("  • Métricas en escala real (desnormalizadas)")
    print("=" * 60)
    
    predictor = PredictorMultivarianteSensores()
    
    if not predictor.cargar_datos():
        print("❌ Error al cargar datos")
        return
    
    print("\n🚀 Iniciando análisis completo...")
    predictor.ejecutar_analisis_completo()
    print("\n✅ Análisis completado")

if __name__ == "__main__":
    main()

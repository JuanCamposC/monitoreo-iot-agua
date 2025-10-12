# 🐟 CIMARQ - Análisis Predictivo ML

Sistema simple de análisis predictivo para sensores IoT acuícolas con predicción a **24 horas**.

## ⚡ Inicio Rápido

### Windows:
```powershell
# Opción 1: PowerShell (recomendado)
.\ejecutar_analisis.ps1

# Opción 2: Comando directo  
docker-compose up --build
```

### Linux/Mac:
```bash
# Opción 1: Script automatizado
chmod +x ejecutar_analisis.sh
./ejecutar_analisis.sh

# Opción 2: Comando directo
docker-compose up --build
```

## 📊 ¿Qué hace?

1. **Carga** los datos del CSV `brisbane_water_quality.csv`
2. **Entrena** 5 modelos ML: ARIMA, SARIMA, Prophet, LSTM, Perceptron  
3. **Predice** valores a 24 horas para: Temperatura, pH, Oxígeno
4. **Compara** todos los modelos con métricas R², MAE, RMSE, MAPE
5. **Genera** reporte para elegir el mejor modelo

## 📁 Resultados

Después del análisis tendrás en `/resultados`:

- `reporte_comparativo_AAAAMMDD_HHMMSS.txt` - **LEE ESTO PRIMERO** 📋
- `analisis_predictivo_24h_AAAAMMDD_HHMMSS.json` - Datos completos
- `graficos_comparativos_AAAAMMDD_HHMMSS.png` - Visualización

## 🏆 Cómo elegir modelo

El reporte `.txt` te dirá:
- ✅ **Mejor modelo por sensor** (mayor R²)
- 📈 **Calidad de predicción** (Excelente/Buena/Regular)
- 🎯 **Recomendación final** por sensor

### Interpretación R²:
- **R² > 0.8** = 🟢 Excelente (usar en producción)
- **R² > 0.6** = 🟡 Bueno (mejorable)  
- **R² < 0.6** = 🟠 Regular (necesita más datos)

## 🐳 Arquitectura Docker

```
📦 docker-compose.yml  - Orquestación simple
📦 Dockerfile         - Python 3.11 + ML libs
📦 /resultados        - Salida aislada
```

**Beneficios:**
- ✅ No afecta tu entorno local
- ✅ Mismas dependencias siempre
- ✅ Fácil de ejecutar
- ✅ Resultados organizados

## 📋 Requisitos

1. **Docker Desktop** instalado y corriendo
2. **Dataset**: `brisbane_water_quality.csv` en esta carpeta
3. **Columnas**: `Timestamp`, `Temperature`, `pH`, `Dissolved Oxygen`

## ⏱️ Tiempo de ejecución

- **ARIMA/SARIMA**: ~2-3 min
- **Prophet**: ~3-5 min (si está instalado)
- **LSTM**: ~5-10 min
- **Perceptron**: ~1-2 min

**Total**: ~15-20 minutos

## ❗ Solución de problemas

### Docker no inicia:
```bash
# Abrir Docker Desktop y esperar a que esté listo
```

### No encuentra CSV:
```bash
# Verificar nombre exacto: brisbane_water_quality.csv
dir  # Windows
ls   # Linux/Mac
```

### Error de memoria LSTM:
- El análisis continuará sin LSTM
- Prophet puede compensar la precisión

### Resultados pobres (R² < 0.5):
- Dataset muy pequeño
- Necesitas más datos históricos
- Prueba con datos de mayor frecuencia

## 🎯 Próximos pasos

Una vez que tengas el reporte:

1. **Lee** el archivo `.txt` completo
2. **Identifica** el mejor modelo por sensor
3. **Implementa** el modelo recomendado en tu sistema
4. **Monitora** la precisión en producción

---

**🐟 CIMARQ - Simple, Eficiente, Directo al grano**
#!/usr/bin/env python3
"""
Script de verificación rápida para CIMARQ ML
"""

def verificar_dependencias():
    """Verificar que todas las dependencias estén instaladas"""
    print("🔍 Verificando dependencias...")
    
    try:
        import pandas as pd
        print("✅ Pandas instalado")
    except ImportError:
        print("❌ Pandas no instalado")
        return False
        
    try:
        import numpy as np
        print("✅ NumPy instalado")
    except ImportError:
        print("❌ NumPy no instalado")
        return False
        
    try:
        import sklearn
        print("✅ Scikit-learn instalado")
    except ImportError:
        print("❌ Scikit-learn no instalado")
        return False
        
    try:
        import tensorflow as tf
        print("✅ TensorFlow instalado")
    except ImportError:
        print("❌ TensorFlow no instalado")
        return False
        
    try:
        import statsmodels
        print("✅ Statsmodels instalado")
    except ImportError:
        print("❌ Statsmodels no instalado")
        return False
        
    try:
        from prophet import Prophet
        print("✅ Prophet instalado")
    except ImportError:
        print("⚠️ Prophet no instalado (opcional)")
        
    try:
        import matplotlib
        print("✅ Matplotlib instalado")
    except ImportError:
        print("❌ Matplotlib no instalado")
        return False
    
    return True

def verificar_dataset():
    """Verificar que el dataset esté disponible"""
    print("\n🔍 Verificando dataset...")
    
    import os
    if os.path.exists('brisbane_water_quality.csv'):
        print("✅ Dataset encontrado")
        return True
    else:
        print("❌ Dataset no encontrado")
        return False

if __name__ == "__main__":
    print("🐟 CIMARQ - Verificación de Sistema ML")
    print("=" * 40)
    
    deps_ok = verificar_dependencias()
    data_ok = verificar_dataset()
    
    print("\n📋 RESUMEN:")
    if deps_ok and data_ok:
        print("🟢 Sistema listo para análisis")
    elif deps_ok:
        print("🟡 Dependencias OK, falta dataset")
    else:
        print("🔴 Faltan dependencias críticas")
    
    print("\n🎯 Para ejecutar análisis: python analisis_predictivo_sensores.py")
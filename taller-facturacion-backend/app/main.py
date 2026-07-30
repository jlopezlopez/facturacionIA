import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.database import get_db_connection

# Importaciones explícitas de los routers
from app.routers.usuarios import router as usuarios_router
from app.routers.clientes import router as clientes_router
from app.routers.facturas import router as facturas_router 
from app.routers.albaran import router as albaran_router
from app.routers.informes import router as informes_router

# Leer variable de entorno (ej: ENVIRONMENT="production")
ENV = os.getenv("ENVIRONMENT", "production") 

if ENV == "production":
    # Desactiva la documentación interactiva y el esquema OpenAPI
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
else:
    # Habilitado solo en desarrollo local
    #app = FastAPI()
    app = FastAPI(title="API Facturación Taller", version="1.0")

# ==========================================
# CONFIGURACIÓN DE CORS (PERMISOS FRONTEND)
# ==========================================

origins = [
    "https://tu-dominio-taller.com",  # Solo tu dominio de producción
    "http://127.0.0.1:5500",          # Si usas algún servidor local para pruebas
    "http://localhost:5500",  
    "https://localhost:5500",
    "http://192.168.18.103:5500",
    "http://192.168.18.103:8000",
]

app.add_middleware(
    CORSMiddleware,
    #allow_origins=["*"], # Permite peticiones desde cualquier origen (perfecto para desarrollo)
    allow_origins=origins, # Permite peticiones solo desde origins)
    allow_credentials=True,
    allow_methods=["*"], # Permite GET, POST, PUT, DELETE, etc.
    allow_headers=["*"], # Permite enviar tokens y cabeceras de seguridad
)

# Registro de rutas usando los nombres explícitos
app.include_router(usuarios_router)
app.include_router(clientes_router)
app.include_router(facturas_router)
app.include_router(albaran_router)  
app.include_router(informes_router)

@app.get("/")
def inicio():
    return {"mensaje": "Bienvenido a la API de Facturación"}

@app.get("/test-db")
def probar_conexion():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT version();")
                db_version = cursor.fetchone()
                return {
                    "status": "Conexión exitosa",
                    "postgres_version": db_version[0]
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error de BD: {str(e)}")
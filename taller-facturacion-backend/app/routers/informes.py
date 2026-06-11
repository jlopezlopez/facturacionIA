from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.database import get_db_connection
from app.auth.dependencies import obtener_usuario_actual
from app.schemas.informes import ResumenMesResponse, PresupuestosPendientesResponse, DocumentoCorto
from datetime import datetime

router = APIRouter(prefix="/informes", tags=["Informes y Estadísticas"])

# ==========================================
# 1. CUÁNTO SE HA FACTURADO ESTE MES
# ==========================================
@router.get("/facturacion-mes", response_model=ResumenMesResponse)
def obtener_facturacion_mes_actual(usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        hoy = datetime.now()
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Consulta que calcula el total sumando (cantidad * precio) * (1 - descuento/100) 
                # filtrando por el año y mes actuales.
                query = """
                    SELECT 
                        COUNT(DISTINCT f.id) as total_facturas,
                        COALESCE(SUM((cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))), 0) as base_imponible,
                        COALESCE(SUM(((cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))) * (1 + (f.iva / 100.0))), 0) as total_con_iva
                    FROM factura f
                    LEFT JOIN conceptofactura cf ON f.id = cf.idfactura
                    WHERE EXTRACT(MONTH FROM f.fecha) = %s 
                      AND EXTRACT(YEAR FROM f.fecha) = %s;
                """
                cursor.execute(query, (hoy.month, hoy.year))
                res = cursor.fetchone()
                
                meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
                
                return {
                    "mes_actual": f"{meses[hoy.month - 1]} {hoy.year}",
                    "facturas_emitidas": res[0],
                    "total_facturado_sin_iva": round(float(res[1]), 2),
                    "total_facturado_con_iva": round(float(res[2]), 2)
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al calcular informe mensual: {str(e)}")


# ==========================================
# 2. PRESUPUESTOS SIN ACEPTAR (PENDIENTES)
# ==========================================
@router.get("/presupuestos-pendientes", response_model=PresupuestosPendientesResponse)
def obtener_presupuestos_pendientes(usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Contamos e importamos los presupuestos donde 'aceptado' sea FALSE
                query = """
                    SELECT 
                        COUNT(DISTINCT p.id) as total_pendientes,
                        COALESCE(SUM((cp.cantidad * cp.preciounidad) * (1 - (cp.descuento / 100.0))), 0) as importe_estimado
                    FROM presupuesto p
                    LEFT JOIN conceptopresupuesto cp ON p.id = cp.idpresupuesto
                    WHERE p.aceptado = FALSE;
                """
                cursor.execute(query)
                res = cursor.fetchone()
                
                return {
                    "total_presupuestos_pendientes": res[0],
                    "importe_estimado_sin_iva": round(float(res[1]), 2)
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener presupuestos pendientes: {str(e)}")


# ==========================================
# 3. MOSTRAR FACTURAS DE UN CLIENTE
# ==========================================
@router.get("/cliente/{cliente_id}/facturas", response_model=List[DocumentoCorto])
def obtener_facturas_cliente(cliente_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT 
                        f.id, f.numerofactura, f.fecha, f.pagado,
                        COALESCE(SUM((cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))), 0) as total_sin_iva
                    FROM factura f
                    LEFT JOIN conceptofactura cf ON f.id = cf.idfactura
                    WHERE f.numerocliente = %s
                    GROUP BY f.id, f.numerofactura, f.fecha, f.pagado
                    ORDER BY f.fecha DESC;
                """
                cursor.execute(query, (cliente_id,))
                filas = cursor.fetchall()
                
                return [
                    {
                        "id": f[0], "numero": f[1], "fecha": f[2],
                        "estado": "Pagado" if f[3] else "Pendiente de Cobro",
                        "total_sin_iva": round(float(f[4]), 2)
                    } for f in filas
                ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al buscar facturas del cliente: {str(e)}")


# ==========================================
# 4. MOSTRAR PRESUPUESTOS DE UN CLIENTE
# ==========================================
@router.get("/cliente/{cliente_id}/presupuestos", response_model=List[DocumentoCorto])
def obtener_presupuestos_cliente(cliente_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT 
                        p.id, p.numeropresupuesto, p.fecha, p.aceptado,
                        COALESCE(SUM((cp.cantidad * cp.preciounidad) * (1 - (cp.descuento / 100.0))), 0) as total_sin_iva
                    FROM presupuesto p
                    LEFT JOIN conceptopresupuesto cp ON p.id = cp.idpresupuesto
                    WHERE p.numerocliente = %s
                    GROUP BY p.id, p.numeropresupuesto, p.fecha, p.aceptado
                    ORDER BY p.fecha DESC;
                """
                cursor.execute(query, (cliente_id,))
                filas = cursor.fetchall()
                
                return [
                    {
                        "id": f[0], "numero": f[1], "fecha": f[2],
                        "estado": "Aceptado y Obra Lanzada" if f[3] else "Pendiente de Aceptación",
                        "total_sin_iva": round(float(f[4]), 2)
                    } for f in filas
                ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al buscar presupuestos del cliente: {str(e)}")
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List
from app.database import get_db_connection
from app.auth.dependencies import obtener_usuario_actual
from app.schemas.informes import ResumenMesResponse, PresupuestosPendientesResponse, DocumentoCorto
from datetime import datetime

router = APIRouter(prefix="/informes", tags=["Informes y Estadísticas"])

# ==========================================
# INFORME ANUAL DESGLOSADO POR MESES Y TRIMESTRES
# ==========================================
@router.get("/informe-anual")
def obtener_informe_anual(
    anio: int = Query(default=datetime.now().year),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Consulta agrupada por el número de mes
                query = """
                    SELECT 
                        EXTRACT(MONTH FROM f.fecha)::INTEGER as mes,
                        COUNT(DISTINCT f.id) as total_facturas,
                        COALESCE(SUM((cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))), 0) as base_imponible,
                        COALESCE(SUM(((cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))) * (f.iva / 100.0)), 0) as total_iva,
                        COALESCE(SUM(((cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))) * (1 + (f.iva / 100.0))), 0) as total_con_iva
                    FROM factura f
                    LEFT JOIN conceptofactura cf ON f.id = cf.idfactura
                    WHERE EXTRACT(YEAR FROM f.fecha) = %s
                    GROUP BY mes
                    ORDER BY mes ASC;
                """
                cursor.execute(query, (anio,))
                filas = cursor.fetchall()
                
                # Mapa básico para asegurar que todos los meses (1 al 12) tengan estructura incluso sin facturas
                meses_nombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
                meses_datos = {i: {"mes": i, "nombre": meses_nombres[i-1], "facturas": 0, "base": 0.0, "iva": 0.0, "total": 0.0} for i in range(1, 13)}

                for f in filas:
                    num_mes = f[0]
                    meses_datos[num_mes] = {
                        "mes": num_mes,
                        "nombre": meses_nombres[num_mes - 1],
                        "facturas": f[1],
                        "base": round(float(f[2]), 2),
                        "iva": round(float(f[3]), 2),
                        "total": round(float(f[4]), 2)
                    }

                return {
                    "anio": anio,
                    "meses": list(meses_datos.values())
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar el informe anual: {str(e)}")


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


    # Añadir al final de informes.py

# ==========================================
# INFORME ANUAL DESGLOSADO POR CLIENTE
# ==========================================
@router.get("/informe-clientes")
def obtener_informe_clientes(
    anio: int = Query(default=datetime.now().year),
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT 
                        c.id as cliente_id,
                        COALESCE(c.razonsocial, 'Cliente Sin Nombre') as razonsocial,
                        COALESCE(c.nif, '-') as nif,
                        COUNT(DISTINCT f.id) as total_facturas,
                        COALESCE(SUM((cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))), 0) as base_imponible,
                        COALESCE(SUM(((cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))) * (f.iva / 100.0)), 0) as total_iva,
                        COALESCE(SUM(((cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))) * (1 + (f.iva / 100.0))), 0) as total_con_iva
                    FROM factura f
                    INNER JOIN cliente c ON f.numerocliente = c.id
                    LEFT JOIN conceptofactura cf ON f.id = cf.idfactura
                    WHERE EXTRACT(YEAR FROM f.fecha) = %s
                    GROUP BY c.id, c.razonsocial, c.nif
                    ORDER BY total_con_iva DESC;
                """
                cursor.execute(query, (anio,))
                filas = cursor.fetchall()

                clientes_datos = []
                for f in filas:
                    clientes_datos.append({
                        "cliente_id": f[0],
                        "razonsocial": f[1],
                        "nif": f[2],
                        "facturas": f[3],
                        "base": round(float(f[4]), 2),
                        "iva": round(float(f[5]), 2),
                        "total": round(float(f[6]), 2)
                    })

                return {
                    "anio": anio,
                    "clientes": clientes_datos
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar el informe por clientes: {str(e)}")
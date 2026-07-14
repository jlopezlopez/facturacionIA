from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from app.database import get_db_connection
from app.schemas.facturacion import FacturaCreate, FacturaResponse, PresupuestoCreate, PresupuestoResponse
from app.utils.pdf_generator import generar_pdf_documento
from datetime import date
from app.auth.dependencies import obtener_usuario_actual
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/facturacion", tags=["Facturas y Presupuestos"])

# ==========================================
# 1. CREAR PRESUPUESTO DESDE CERO
# ==========================================
@router.post("/presupuestos", response_model=PresupuestoResponse, status_code=status.HTTP_201_CREATED)
def crear_presupuesto(presupuesto: PresupuestoCreate, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Insertar cabecera del presupuesto
                cursor.execute(
                    """INSERT INTO presupuesto (numeropresupuesto, fecha, iva, numerocliente, aceptado) 
                       VALUES (%s, %s, %s, %s, %s) RETURNING id;""",
                    (presupuesto.numeropresupuesto, presupuesto.fecha, presupuesto.iva, presupuesto.numerocliente, presupuesto.aceptado)
                )
                presupuesto_id = cursor.fetchone()[0]
                
                # Insertar sus conceptos asociados
                for c in presupuesto.conceptos:
                    cursor.execute(
                        """INSERT INTO conceptopresupuesto (numeroconpresup, idpresupuesto, descripcion, cantidad, preciounidad, descuento)
                           VALUES (%s, %s, %s, %s, %s, %s);""",
                        (c.numeroconcepto, presupuesto_id, c.descripcion, c.cantidad, c.preciounidad, c.descuento)
                    )
                
                conn.commit()
                return {
                    "id": presupuesto_id, **presupuesto.model_dump()
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar el presupuesto: {str(e)}")


# ==========================================
# 2. CREAR FACTURA DESDE CERO
# ==========================================
@router.post("/facturas", response_model=FacturaResponse, status_code=status.HTTP_201_CREATED)
def crear_factura(factura: FacturaCreate, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Insertar cabecera de la factura
                cursor.execute(
                    """INSERT INTO factura (numerofactura, fecha, iva, numerocliente, pagado) 
                       VALUES (%s, %s, %s, %s, %s) RETURNING id;""",
                    (factura.numerofactura, factura.fecha, factura.iva, factura.numerocliente, factura.pagado)
                )
                factura_id = cursor.fetchone()[0]
                
                # Insertar conceptos asociados
                for c in factura.conceptos:
                    cursor.execute(
                        """INSERT INTO conceptofactura (numeroconcepto, idfactura, descripcion, cantidad, preciounidad, descuento)
                           VALUES (%s, %s, %s, %s, %s, %s);""",
                        (c.numeroconcepto, factura_id, c.descripcion, c.cantidad, c.preciounidad, c.descuento)
                    )
                
                conn.commit()
                return {
                    "id": factura_id, **factura.model_dump()
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar la factura: {str(e)}")


# ==========================================
# 3. TRANSFORMAR PRESUPUESTO A FACTURA
# ==========================================
@router.post("/presupuestos/{presupuesto_id}/facturar", status_code=status.HTTP_201_CREATED)
def transformar_presupuesto_a_factura(presupuesto_id: int, nuevo_numero_factura: str, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Obtener la cabecera del presupuesto
                cursor.execute(
                    "SELECT numeropresupuesto, fecha, iva, numerocliente FROM presupuesto WHERE id = %s;", 
                    (presupuesto_id,)
                )
                presupuesto = cursor.fetchone()
                if not presupuesto:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
                
                # 2. Obtener los conceptos del presupuesto
                cursor.execute(
                    "SELECT numeroconpresup, descripcion, cantidad, preciounidad, descuento FROM conceptopresupuesto WHERE idpresupuesto = %s;",
                    (presupuesto_id,)
                )
                conceptos = cursor.fetchall()
                
                # 3. Actualizar presupuesto a "aceptado = True"
                cursor.execute("UPDATE presupuesto SET aceptado = TRUE WHERE id = %s;", (presupuesto_id,))
                
                # 4. Insertar la nueva factura usando la fecha de hoy
                cursor.execute(
                    """INSERT INTO factura (numerofactura, fecha, iva, numerocliente, pagado)
                       VALUES (%s, %s, %s, %s, FALSE) RETURNING id;""",
                    (nuevo_numero_factura, date.today(), presupuesto[2], presupuesto[3])
                )
                nueva_factura_id = cursor.fetchone()[0]
                
                # 5. Clonar las líneas del presupuesto hacia la factura
                for con in conceptos:
                    cursor.execute(
                        """INSERT INTO conceptofactura (numeroconcepto, idfactura, descripcion, cantidad, preciounidad, descuento)
                           VALUES (%s, %s, %s, %s, %s, %s);""",
                        (con[0], nueva_factura_id, con[1], con[2], con[3], con[4])
                    )
                
                conn.commit()
                return {
                    "status": "éxito",
                    "mensaje": f"Presupuesto {presupuesto_id} transformado correctamente en la Factura ID {nueva_factura_id}",
                    "factura_id": nueva_factura_id
                }
                
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error durante la conversión: {str(e)}")


# ==========================================
# 4. DESCARGAR PRESUPUESTO EN PDF
# ==========================================
@router.get("/presupuestos/{presupuesto_id}/pdf")
def descargar_presupuesto_pdf(presupuesto_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query_presupuesto = """
                    SELECT p.numeropresupuesto, p.fecha, p.iva, c.razonsocial, c.NIF, c.calle, c.numero, c.piso, c.poblacion, c.provincia, c.telefono
                    FROM presupuesto p
                    INNER JOIN cliente c ON p.numerocliente = c.id
                    WHERE p.id = %s;
                """
                cursor.execute(query_presupuesto, (presupuesto_id,))
                res = cursor.fetchone()
                if not res:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
                
                cabecera = {"numero": res[0], "fecha": str(res[1]), "iva_porcentaje": float(res[2])}
                cliente = {
                    "razonsocial": res[3], "NIF": res[4], "calle": res[5], "numero": res[6],
                    "piso": res[7], "poblacion": res[8], "provincia": res[9], "telefono": res[10]
                }
                
                cursor.execute(
                    "SELECT descripcion, cantidad, preciounidad, descuento FROM conceptopresupuesto WHERE idpresupuesto = %s ORDER BY numeroconpresup ASC;",
                    (presupuesto_id,)
                )
                conceptos_filas = cursor.fetchall()
                conceptos = [
                    {"descripcion": f[0], "cantidad": float(f[1]), "preciounidad": float(f[2]), "descuento": float(f[3])}
                    for f in conceptos_filas
                ]
                
                pdf_buffer = generar_pdf_documento("PRESUPUESTO", cabecera, cliente, conceptos)
                
                return StreamingResponse(
                    pdf_buffer,
                    media_type="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=Presupuesto_{cabecera['numero']}.pdf"}
                )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar PDF de presupuesto: {str(e)}")


# ==========================================
# 5. DESCARGAR FACTURA EN PDF
# ==========================================
@router.get("/facturas/{factura_id}/pdf")
def descargar_factura_pdf(factura_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query_factura = """
                    SELECT f.numerofactura, f.fecha, f.iva, c.razonsocial, c.NIF, c.calle, c.numero, c.piso, c.poblacion, c.provincia, c.telefono
                    FROM factura f
                    INNER JOIN cliente c ON f.numerocliente = c.id
                    WHERE f.id = %s;
                """
                cursor.execute(query_factura, (factura_id,))
                res = cursor.fetchone()
                if not res:
                    raise HTTPException(status_code=404, detail="Factura no encontrada")
                
                cabecera = {"numero": res[0], "fecha": str(res[1]), "iva_porcentaje": float(res[2])}
                cliente = {
                    "razonsocial": res[3], "NIF": res[4], "calle": res[5], "numero": res[6],
                    "piso": res[7], "poblacion": res[8], "provincia": res[9], "telefono": res[10]
                }
                
                cursor.execute(
                    "SELECT descripcion, cantidad, preciounidad, descuento FROM conceptofactura WHERE idfactura = %s ORDER BY numeroconcepto ASC;",
                    (factura_id,)
                )
                conceptos_filas = cursor.fetchall()
                conceptos = [
                    {"descripcion": f[0], "cantidad": float(f[1]), "preciounidad": float(f[2]), "descuento": float(f[3])}
                    for f in conceptos_filas
                ]
                
                pdf_buffer = generar_pdf_documento("FACTURA", cabecera, cliente, conceptos)
                
                return StreamingResponse(
                    pdf_buffer,
                    media_type="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=Factura_{cabecera['numero']}.pdf"}
                )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar PDF de factura: {str(e)}")
    

    # ==========================================
# 6. OBTENER TODOS LOS PRESUPUESTOS (CON CLIENTE)
# ==========================================
@router.get("/presupuestos/detallados")
def obtener_presupuestos_detallados(usuario_actual: dict = Depends(obtener_usuario_actual)):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            query = """
                SELECT p.id, p.numeropresupuesto, p.fecha, p.aceptado, p.iva, c.razonsocial, c.NIF, p.numerocliente
                FROM presupuesto p
                INNER JOIN cliente c ON p.numerocliente = c.id
                ORDER BY p.id DESC;
            """
            cursor.execute(query)
            filas = cursor.fetchall()
            return [{
                "id": f[0], "numero": f[1], "fecha": str(f[2]), "aceptado": f[3], "iva": float(f[4]),
                "razonsocial": f[5], "NIF": f[6], "numerocliente": f[7]
            } for f in filas]

# ==========================================
# 7. OBTENER TODAS LAS FACTURAS (CON CLIENTE)
# ==========================================
@router.get("/facturas/detallados")
def obtener_facturas_detallados(usuario_actual: dict = Depends(obtener_usuario_actual)):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            query = """
                SELECT f.id, f.numerofactura, f.fecha, f.pagado, f.iva, c.razonsocial, c.NIF, f.numerocliente
                FROM factura f
                INNER JOIN cliente c ON f.numerocliente = c.id
                ORDER BY f.id DESC;
            """
            cursor.execute(query)
            filas = cursor.fetchall()
            return [{
                "id": f[0], "numero": f[1], "fecha": str(f[2]), "pagado": f[3], "iva": float(f[4]),
                "razonsocial": f[5], "NIF": f[6], "numerocliente": f[7]
            } for f in filas]
        

# ==========================================
# 8. OBTENER DETALLE DE UNA FACTURA INDIVIDUAL (CON CONCEPTOS)
# ==========================================
@router.get("/facturas/{factura_id}")
def obtener_detalle_factura(factura_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Buscar cabecera y datos de cliente
                query = """
                    SELECT f.id, f.numerofactura, f.fecha, f.pagado, f.iva, 
                           c.razonsocial, c.NIF, c.calle, c.numero, c.poblacion
                    FROM factura f
                    INNER JOIN cliente c ON f.numerocliente = c.id
                    WHERE f.id = %s;
                """
                cursor.execute(query, (factura_id,))
                res = cursor.fetchone()
                if not res:
                    raise HTTPException(status_code=404, detail="Factura no encontrada")
                
                # 2. Buscar conceptos vinculados
                cursor.execute(
                    "SELECT descripcion, cantidad, preciounidad, descuento FROM conceptofactura WHERE idfactura = %s ORDER BY numeroconcepto ASC;",
                    (factura_id,)
                )
                conceptos_filas = cursor.fetchall()
                conceptos = [
                    {"descripcion": f[0], "cantidad": float(f[1]), "precio_unitario": float(f[2]), "descuento": float(f[3])}
                    for f in conceptos_filas
                ]
                
                return {
                    "id": res[0], "numero": res[1], "fecha": str(res[2]), "pagada": res[3], "iva": float(res[4]),
                    "razonsocial": res[5], "NIF": res[6], "calle": res[7], "cliente_numero": res[8], "poblacion": res[9],
                    "conceptos": conceptos
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al recuperar la factura: {str(e)}")


# ==========================================
# 9. OBTENER DETALLE DE UN PRESUPUESTO INDIVIDUAL (CON CONCEPTOS)
# ==========================================
@router.get("/presupuestos/{presupuesto_id}")
def obtener_detalle_presupuesto(presupuesto_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Buscar cabecera y datos de cliente
                query = """
                    SELECT p.id, p.numeropresupuesto, p.fecha, p.aceptado, p.iva, 
                           c.razonsocial, c.NIF, c.calle, c.numero, c.poblacion
                    FROM presupuesto p
                    INNER JOIN cliente c ON p.numerocliente = c.id
                    WHERE p.id = %s;
                """
                cursor.execute(query, (presupuesto_id,))
                res = cursor.fetchone()
                if not res:
                    raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
                
                # 2. Buscar conceptos vinculados
                cursor.execute(
                    "SELECT descripcion, cantidad, preciounidad, descuento FROM conceptopresupuesto WHERE idpresupuesto = %s ORDER BY numeroconpresup ASC;",
                    (presupuesto_id,)
                )
                conceptos_filas = cursor.fetchall()
                conceptos = [
                    {"descripcion": f[0], "cantidad": float(f[1]), "precio_unitario": float(f[2]), "descuento": float(f[3])}
                    for f in conceptos_filas
                ]
                
                return {
                    "id": res[0], "numero": res[1], "fecha": str(res[2]), "aceptado": res[3], "iva": float(res[4]),
                    "razonsocial": res[5], "NIF": res[6], "calle": res[7], "cliente_numero": res[8], "poblacion": res[9],
                    "conceptos": conceptos
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al recuperar el presupuesto: {str(e)}")
    
    # ==========================================
# NUEVO: ESQUEMAS PARA LA ACTUALIZACIÓN DE FACTURA
# ==========================================
class ConceptoFacturaUpdate(BaseModel):
    descripcion: str
    cantidad: float
    precio_unitario: float
    descuento: float

class FacturaUpdate(BaseModel):
    pagada: bool
    conceptos: List[ConceptoFacturaUpdate]


# ==========================================
# NUEVO: 8B. ACTUALIZAR ESTADO Y CONCEPTOS DE FACTURA
# ==========================================
@router.put("/facturas/{factura_id}", status_code=status.HTTP_200_OK)
def actualizar_factura(
    factura_id: int, 
    payload: FacturaUpdate, 
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Comprobar si la factura existe
                cursor.execute("SELECT id FROM factura WHERE id = %s;", (factura_id,))
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Factura no encontrada")

                # 2. Actualizar la propiedad "pagado" en la cabecera
                cursor.execute(
                    "UPDATE factura SET pagado = %s WHERE id = %s;",
                    (payload.pagada, factura_id)
                )

                # 3. Eliminar los conceptos antiguos vinculados
                cursor.execute(
                    "DELETE FROM conceptofactura WHERE idfactura = %s;",
                    (factura_id,)
                )

                # 4. Insertar los nuevos conceptos actualizados
                # Usaremos un autoincremento para 'numeroconcepto' partiendo de 1
                for index, c in enumerate(payload.conceptos, start=1):
                    cursor.execute(
                        """INSERT INTO conceptofactura (numeroconcepto, idfactura, descripcion, cantidad, preciounidad, descuento)
                           VALUES (%s, %s, %s, %s, %s, %s);""",
                        (index, factura_id, c.descripcion, c.cantidad, c.precio_unitario, c.descuento)
                    )

                # Confirmar toda la transacción de manera segura
                conn.commit()
                
                return {
                    "status": "éxito",
                    "mensaje": f"Factura {factura_id} y sus conceptos actualizados correctamente."
                }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error al actualizar la factura en el servidor: {str(e)}"
        )
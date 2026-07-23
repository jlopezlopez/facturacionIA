from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from app.database import get_db_connection
from app.schemas.albaran import NotasCreate, NotasResponse, AlbaranCreate, AlbaranResponse
from app.utils.pdf_generator import generar_pdf_documento
from datetime import date
from app.auth.dependencies import obtener_usuario_actual
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/albaran", tags=["Albaran y Notas"])

# ==========================================
# 1. CREAR Albaran DESDE CERO
# ==========================================
@router.post("/albaran", response_model=AlbaranResponse, status_code=status.HTTP_201_CREATED)
def crear_albaran(albaran: AlbaranCreate, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Insertar cabecera del albaran
                cursor.execute(
                    """INSERT INTO albaran (numeroalbaran, fecha, iva, numerocliente, aceptado) 
                       VALUES (%s, %s, %s, %s, %s) RETURNING id;""",
                    (albaran.numeroalbaran, albaran.fecha, albaran.iva, albaran.numerocliente, albaran.aceptado)
                )
                albaran_id = cursor.fetchone()[0]
                
                # Insertar sus conceptos asociados
                for c in albaran.conceptos:
                    cursor.execute(
                        """INSERT INTO conceptoalbaran (numeroalbaran, idalbaran, descripcion, cantidad, preciounidad, descuento)
                           VALUES (%s, %s, %s, %s, %s, %s);""",
                        (c.numeroconcepto, albaran_id, c.descripcion, c.cantidad, c.preciounidad, c.descuento)
                    )
                
                conn.commit()
                return {
                    "id": albaran_id, **albaran.model_dump()
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar el albaran: {str(e)}")


# ==========================================
# 2. CREAR NOTA DESDE CERO
# ==========================================
@router.post("/notas", response_model=NotasResponse, status_code=status.HTTP_201_CREATED)
def crear_nota(nota: NotasCreate, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Insertar cabecera de la nota
                cursor.execute(
                    """INSERT INTO nota (numeronota, fecha, iva, numerocliente, aceptado) 
                       VALUES (%s, %s, %s, %s, %s) RETURNING id;""",
                    (nota.numeronota, nota.fecha, nota.iva, nota.numerocliente, nota.aceptado)
                )
                nota_id = cursor.fetchone()[0]
                
                # Insertar conceptos asociados
                for c in nota.conceptos:
                    cursor.execute(
                        """INSERT INTO conceptonota (numeroconcepto, idnota, descripcion, cantidad, preciounidad, descuento)
                           VALUES (%s, %s, %s, %s, %s, %s);""",
                        (c.numeroconcepto, nota_id, c.descripcion, c.cantidad, c.preciounidad, c.descuento)
                    )
                
                conn.commit()
                return {
                    "id": nota_id, **nota.model_dump()
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar la factura: {str(e)}")


# ==========================================
# 3. TRANSFORMAR ALBARAN A FACTURA
# ==========================================
@router.post("/albaran/{albaran_id}/facturar", status_code=status.HTTP_201_CREATED)
def transformar_albaran_a_factura(albaran_id: int, nuevo_numero_factura: str, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Obtener la cabecera del albaran
                cursor.execute(
                    "SELECT numeroalbaran, fecha, iva, numerocliente FROM albaran WHERE id = %s;", 
                    (albaran_id,)
                )
                albaran = cursor.fetchone()
                if not albaran:
                    raise HTTPException(status_code=404, detail="Albaran no encontrado")
                
                # 2. Obtener los conceptos del albaran
                cursor.execute(
                    "SELECT numeroalbaran, descripcion, cantidad, preciounidad, descuento FROM conceptoalbaran WHERE idalbaran = %s;",
                    (albaran_id,)
                )
                conceptos = cursor.fetchall()
                
                # 3. Actualizar albaran a "aceptado = True"
                cursor.execute("UPDATE albaran SET aceptado = TRUE WHERE id = %s;", (albaran_id,))
                
                # 4. Insertar la nueva factura usando la fecha de hoy
                cursor.execute(
                    """INSERT INTO factura (numerofactura, fecha, iva, numerocliente, pagado)
                       VALUES (%s, %s, %s, %s, FALSE) RETURNING id;""",
                    (nuevo_numero_factura, date.today(), albaran[2], albaran[3])
                )
                nueva_factura_id = cursor.fetchone()[0]
                
                # 5. Clonar las líneas del albaran hacia la factura
                for con in conceptos:
                    cursor.execute(
                        """INSERT INTO conceptofactura (numeroconcepto, idfactura, descripcion, cantidad, preciounidad, descuento)
                           VALUES (%s, %s, %s, %s, %s, %s);""",
                        (con[0], nueva_factura_id, con[1], con[2], con[3], con[4])
                    )
                
                conn.commit()
                return {
                    "status": "éxito",
                    "mensaje": f"Albaran {albaran_id} transformado correctamente en la Factura ID {nueva_factura_id}",
                    "factura_id": nueva_factura_id
                }
                
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error durante la conversión: {str(e)}")


# ==========================================
# 4. DESCARGAR ALBARAN EN PDF
# ==========================================
@router.get("/albaran/{albaran_id}/pdf")
def descargar_albaran_pdf(albaran_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query_albaran = """
                    SELECT p.numeroalbaran, p.fecha, p.iva, c.razonsocial, c.NIF, c.calle, c.numero, c.piso, c.poblacion, c.provincia, c.telefono
                    FROM albaran p
                    INNER JOIN cliente c ON p.numerocliente = c.id
                    WHERE p.id = %s;
                """
                cursor.execute(query_albaran, (albaran_id,))
                res = cursor.fetchone()
                if not res:
                    raise HTTPException(status_code=404, detail="Albaran no encontrado")
                
                cabecera = {"numero": res[0], "fecha": str(res[1]), "iva_porcentaje": float(res[2])}
                cliente = {
                    "razonsocial": res[3], "NIF": res[4], "calle": res[5], "numero": res[6],
                    "piso": res[7], "poblacion": res[8], "provincia": res[9], "telefono": res[10]
                }
                
                cursor.execute(
                    "SELECT descripcion, cantidad, preciounidad, descuento FROM conceptoalbaran WHERE idalbaran = %s ORDER BY numeroconpresup ASC;",
                    (albaran_id,)
                )
                conceptos_filas = cursor.fetchall()
                conceptos = [
                    {"descripcion": f[0], "cantidad": float(f[1]), "preciounidad": float(f[2]), "descuento": float(f[3])}
                    for f in conceptos_filas
                ]
                
                pdf_buffer = generar_pdf_documento("ALBARAN", cabecera, cliente, conceptos)
                
                return StreamingResponse(
                    pdf_buffer,
                    media_type="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=Albaran_{cabecera['numero']}.pdf"}
                )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar PDF de albaran: {str(e)}")


# ==========================================
# 5. DESCARGAR NOTA EN PDF
# ==========================================
@router.get("/notas/{nota_id}/pdf")
def descargar_nota_pdf(nota_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query_nota = """
                    SELECT f.numeronota, f.fecha, f.iva, c.razonsocial, c.NIF, c.calle, c.numero, c.piso, c.poblacion, c.provincia, c.telefono
                    FROM nota f
                    INNER JOIN cliente c ON f.numerocliente = c.id
                    WHERE f.id = %s;
                """
                cursor.execute(query_nota, (nota_id,))
                res = cursor.fetchone()
                if not res:
                    raise HTTPException(status_code=404, detail="Nota no encontrada")
                
                cabecera = {"numero": res[0], "fecha": str(res[1]), "iva_porcentaje": float(res[2])}
                cliente = {
                    "razonsocial": res[3], "NIF": res[4], "calle": res[5], "numero": res[6],
                    "piso": res[7], "poblacion": res[8], "provincia": res[9], "telefono": res[10]
                }
                
                cursor.execute(
                    "SELECT descripcion, cantidad, preciounidad, descuento FROM conceptonota WHERE idnota = %s ORDER BY numeroconcepto ASC;",
                    (nota_id,)
                )
                conceptos_filas = cursor.fetchall()
                conceptos = [
                    {"descripcion": f[0], "cantidad": float(f[1]), "preciounidad": float(f[2]), "descuento": float(f[3])}
                    for f in conceptos_filas
                ]
                
                pdf_buffer = generar_pdf_documento("NOTA", cabecera, cliente, conceptos)
                
                return StreamingResponse(
                    pdf_buffer,
                    media_type="application/pdf",
                    headers={"Content-Disposition": f"inline; filename=Nota_{cabecera['numero']}.pdf"}
                )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar PDF de nota: {str(e)}")
    

    # ==========================================
# 6. OBTENER TODOS LOS ALBARANS (CON CLIENTE)
# ==========================================
@router.get("/albaran/detallados")
def obtener_albaran_detallados(usuario_actual: dict = Depends(obtener_usuario_actual)):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
                       # SQL mejorado que calcula la base imponible y el total con IVA aplicado directamente desde la DB
            query = """
                SELECT 
                    f.id, 
                    f.numeroalbaran, 
                    f.fecha, 
                    f.aceptado, 
                    f.iva, 
                    c.razonsocial, 
                    c.NIF, 
                    f.numerocliente,
                    COALESCE(
                        SUM(
                            (cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))
                        ), 0
                    ) AS base_imponible
                FROM albaran f
                INNER JOIN cliente c ON f.numerocliente = c.id
                LEFT JOIN conceptoalbaran cf ON f.id = cf.idalbaran
                GROUP BY f.id, f.numeroalbaran, f.fecha, f.aceptado, f.iva, c.razonsocial, c.NIF, f.numerocliente
                ORDER BY f.id DESC;
            """
            cursor.execute(query)
            filas = cursor.fetchall()
            resultado = []
            for f in filas:
                base_imponible = float(f[8])
                porcentaje_iva = float(f[4])
                
                # Calculamos el total con el IVA sumado
                total_con_iva = base_imponible * (1 + (porcentaje_iva / 100.0))
                
                resultado.append({
                    "id": f[0], 
                    "numero": f[1], 
                    "fecha": str(f[2]), 
                    "aceptado": f[3], 
                    "iva": porcentaje_iva,
                    "razonsocial": f[5], 
                    "NIF": f[6], 
                    "numerocliente": f[7],
                    "total": total_con_iva  # <--- Enviamos el importe calculado listo al Frontend
                })
                
            return resultado

# ==========================================
# 7. OBTENER TODAS LAS NOTAS (CON CLIENTE)
# ==========================================
@router.get("/notas/detallados")
def obtener_notas_detallados(usuario_actual: dict = Depends(obtener_usuario_actual)):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # SQL mejorado que calcula la base imponible y el total con IVA aplicado directamente desde la DB
            query = """
                SELECT 
                    f.id, 
                    f.numeronota, 
                    f.fecha, 
                    f.aceptado, 
                    f.iva, 
                    c.razonsocial, 
                    c.NIF, 
                    f.numerocliente,
                    COALESCE(
                        SUM(
                            (cf.cantidad * cf.preciounidad) * (1 - (cf.descuento / 100.0))
                        ), 0
                    ) AS base_imponible
                FROM nota f
                INNER JOIN cliente c ON f.numerocliente = c.id
                LEFT JOIN conceptonota cf ON f.id = cf.idnota
                GROUP BY f.id, f.numeronota, f.fecha, f.aceptado, f.iva, c.razonsocial, c.NIF, f.numerocliente
                ORDER BY f.id DESC;
            """
            cursor.execute(query)
            filas = cursor.fetchall()
            resultado = []
            for f in filas:
                base_imponible = float(f[8])
                porcentaje_iva = float(f[4])
                
                # Calculamos el total con el IVA sumado
                total_con_iva = base_imponible * (1 + (porcentaje_iva / 100.0))
                
                resultado.append({
                    "id": f[0], 
                    "numero": f[1], 
                    "fecha": str(f[2]), 
                    "aceptado": f[3], 
                    "iva": porcentaje_iva,
                    "razonsocial": f[5], 
                    "NIF": f[6], 
                    "numerocliente": f[7],
                    "total": total_con_iva  # <--- Enviamos el importe calculado listo al Frontend
                })
                
            return resultado
        

# ==========================================
# 8. OBTENER DETALLE DE UNA NOTA INDIVIDUAL (CON CONCEPTOS)
# ==========================================
@router.get("/notas/{nota_id}")
def obtener_detalle_nota(nota_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Buscar cabecera y datos de cliente
                query = """
                    SELECT f.id, f.numeronota, f.fecha, f.aceptado, f.iva, 
                           c.razonsocial, c.NIF, c.calle, c.numero, c.poblacion
                    FROM nota f
                    INNER JOIN cliente c ON f.numerocliente = c.id
                    WHERE f.id = %s;
                """
                cursor.execute(query, (nota_id,))
                res = cursor.fetchone()
                if not res:
                    raise HTTPException(status_code=404, detail="Nota no encontrada")
                
                # 2. Buscar conceptos vinculados
                cursor.execute(
                    "SELECT descripcion, cantidad, preciounidad, descuento FROM conceptonota WHERE idnota = %s ORDER BY numeroconcepto ASC;",
                    (nota_id,)
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
        raise HTTPException(status_code=500, detail=f"Error al recuperar la nota: {str(e)}")


# ==========================================
# 9. OBTENER DETALLE DE UN ALBARAN INDIVIDUAL (CON CONCEPTOS)
# ==========================================
@router.get("/albaran/{albaran_id}")
def obtener_detalle_albaran(albaran_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Buscar cabecera y datos de cliente
                query = """
                    SELECT p.id, p.numeroalbaran, p.fecha, p.aceptado, p.iva, 
                           c.razonsocial, c.NIF, c.calle, c.numero, c.poblacion
                    FROM albaran p
                    INNER JOIN cliente c ON p.numerocliente = c.id
                    WHERE p.id = %s;
                """
                cursor.execute(query, (albaran_id,))
                res = cursor.fetchone()
                if not res:
                    raise HTTPException(status_code=404, detail="Albaran no encontrado")
                
                # 2. Buscar conceptos vinculados
                cursor.execute(
                    "SELECT descripcion, cantidad, preciounidad, descuento FROM conceptoalbaran WHERE idalbaran = %s ORDER BY numeroconpresup ASC;",
                    (albaran_id,)
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
        raise HTTPException(status_code=500, detail=f"Error al recuperar el albaran: {str(e)}")
    
# ==========================================
# NUEVO: ESQUEMAS PARA LA ACTUALIZACIÓN DE NOTA
# ==========================================
class ConceptoNotaUpdate(BaseModel):
    descripcion: str
    cantidad: float
    precio_unitario: float
    descuento: float

class NotaUpdate(BaseModel):
    pagada: bool
    conceptos: List[ConceptoNotaUpdate]


# ==========================================
# NUEVO: 8B. ACTUALIZAR ESTADO Y CONCEPTOS DE NOTA
# ==========================================
@router.put("/notas/{nota_id}", status_code=status.HTTP_200_OK)
def actualizar_nota(
    nota_id: int, 
    payload: NotaUpdate, 
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Comprobar si la nota existe
                cursor.execute("SELECT id FROM nota WHERE id = %s;", (nota_id,))
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Nota no encontrada")

                # 2. Actualizar la propiedad "aceptado" en la cabecera
                cursor.execute(
                    "UPDATE nota SET aceptado = %s WHERE id = %s;",
                    (payload.aceptado, nota_id)
                )

                # 3. Eliminar los conceptos antiguos vinculados
                cursor.execute(
                    "DELETE FROM conceptonota WHERE idnota = %s;",
                    (nota_id,)
                )

                # 4. Insertar los nuevos conceptos actualizados
                # Usaremos un autoincremento para 'numeroconcepto' partiendo de 1
                for index, c in enumerate(payload.conceptos, start=1):
                    cursor.execute(
                        """INSERT INTO conceptonota (numeroconcepto, idnota, descripcion, cantidad, preciounidad, descuento)
                           VALUES (%s, %s, %s, %s, %s, %s);""",
                        (index, nota_id, c.descripcion, c.cantidad, c.precio_unitario, c.descuento)
                    )

                # Confirmar toda la transacción de manera segura
                conn.commit()
                
                return {
                    "status": "éxito",
                    "mensaje": f"Nota {nota_id} y sus conceptos actualizados correctamente."
                }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error al actualizar la nota en el servidor: {str(e)}"
        )
    

# ==========================================
# NUEVO: ELIMINAR NOTA Y SUS CONCEPTOS
# ==========================================
@router.delete("/notas/{nota_id}", status_code=status.HTTP_200_OK)
def eliminar_nota(
    nota_id: int, 
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Comprobar si la nota existe
                cursor.execute("SELECT id FROM nota WHERE id = %s;", (nota_id,))
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Nota no encontrada")

                # 2. Eliminar primero los conceptos asociados en conceptonota
                cursor.execute(
                    "DELETE FROM conceptonota WHERE idnota = %s;",
                    (nota_id,)
                )

                # 3. Eliminar la cabecera de la nota
                cursor.execute(
                    "DELETE FROM nota WHERE id = %s;",
                    (nota_id,)
                )

                # 4. Confirmar la transacción completa de forma segura
                conn.commit()

                return {
                    "status": "éxito",
                    "mensaje": f"Nota {nota_id} eliminada correctamente."
                }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error al eliminar la nota en el servidor: {str(e)}"
        )
    
# ==========================================
# NUEVO: ELIMINAR ALBARAN Y SUS CONCEPTOS
# ==========================================
@router.delete("/albaran/{albaran_id}", status_code=status.HTTP_200_OK)
def eliminar_albaran(
    albaran_id: int, 
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Comprobar si la albaran existe
                cursor.execute("SELECT id FROM albaran WHERE id = %s;", (albaran_id,))
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Albaran no encontrado")

                # 2. Eliminar primero los conceptos asociados en conceptoalbaran
                cursor.execute(
                    "DELETE FROM conceptoalbaran WHERE idalbaran = %s;",
                    (albaran_id,)
                )

                # 3. Eliminar la cabecera del albaran
                cursor.execute(
                    "DELETE FROM albaran WHERE id = %s;",
                    (albaran_id,)
                )

                # 4. Confirmar la transacción completa de forma segura
                conn.commit()

                return {
                    "status": "éxito",
                    "mensaje": f"Albaran {albaran_id} eliminado correctamente."
                }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error al eliminar el albaran en el servidor: {str(e)}"
        )
    
# ==========================================
# NUEVO: ESQUEMAS PARA LA ACTUALIZACIÓN DE ALBARAN
# ==========================================
class ConceptoAlbaranUpdate(BaseModel):
    descripcion: str
    cantidad: float
    precio_unitario: float
    descuento: float

class AlbaranUpdate(BaseModel):
    aceptado: bool
    conceptos: List[ConceptoAlbaranUpdate]
    
# ==========================================
# NUEVO: 9B. ACTUALIZAR ESTADO Y CONCEPTOS DE Albarans
# ==========================================
@router.put("/albaran/{albaran_id}", status_code=status.HTTP_200_OK)
def actualizar_albaran(
    albaran_id: int, 
    payload: AlbaranUpdate, 
    usuario_actual: dict = Depends(obtener_usuario_actual)
):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Comprobar si la albaran existe
                cursor.execute("SELECT id FROM albaran WHERE id = %s;", (albaran_id,))
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Albaran no encontrado")

                # 1. Eliminar los conceptos antiguos vinculados
                cursor.execute(
                    "DELETE FROM conceptoalbaran WHERE idalbaran = %s;",
                    (albaran_id,)
                )

                # 4. Insertar los nuevos conceptos actualizados
                # Usaremos un autoincremento para 'numeroconcepto' partiendo de 1
                for index, c in enumerate(payload.conceptos, start=1):
                    cursor.execute(
                        """INSERT INTO conceptoalbaran (numeroconpresup, idalbaran, descripcion, cantidad, preciounidad, descuento)
                           VALUES (%s, %s, %s, %s, %s, %s);""",
                        (index, albaran_id, c.descripcion, c.cantidad, c.precio_unitario, c.descuento)
                    )

                # Confirmar toda la transacción de manera segura
                conn.commit()
                
                return {
                    "status": "éxito",
                    "mensaje": f"albaran {albaran_id} y sus conceptos actualizados correctamente."
                }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error al actualizar el albaran en el servidor: {str(e)}"
        )
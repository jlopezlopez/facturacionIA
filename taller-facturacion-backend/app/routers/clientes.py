from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from app.database import get_db_connection
from app.schemas.cliente import ClienteCreate, ClienteResponse
from app.auth.dependencies import obtener_usuario_actual # Importamos la protección

router = APIRouter(prefix="/clientes", tags=["Clientes"])

# 1. CREAR UN CLIENTE
@router.post("/", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
def crear_cliente(cliente: ClienteCreate, usuario_actual: dict = Depends(obtener_usuario_actual)):
    # Puedes usar 'usuario_actual' si quisieras saber quién creó el cliente (ej: usuario_actual['usuario'])
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = """
                    INSERT INTO cliente (NIF, razonsocial, calle, numero, piso, poblacion, provincia, CP, telefono, observaciones)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, NIF, razonsocial, calle, numero, piso, poblacion, provincia, CP, telefono, observaciones;
                """
                cursor.execute(query, (
                    cliente.NIF, cliente.razonsocial, cliente.calle, cliente.numero,
                    cliente.piso, cliente.poblacion, cliente.provincia, cliente.CP,
                    cliente.telefono, cliente.observaciones
                ))
                nuevo = cursor.fetchone()
                conn.commit()
                
                return {
                    "id": nuevo[0], "NIF": nuevo[1], "razonsocial": nuevo[2], "calle": nuevo[3],
                    "numero": nuevo[4], "piso": nuevo[5], "poblacion": nuevo[6], "provincia": nuevo[7],
                    "CP": nuevo[8], "telefono": nuevo[9], "observaciones": nuevo[10]
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear cliente: {str(e)}")

# 2. OBTENER TODOS LOS CLIENTES
@router.get("/", response_model=List[ClienteResponse])
def obtener_clientes(usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, NIF, razonsocial, calle, numero, piso, poblacion, provincia, CP, telefono, observaciones FROM cliente ORDER BY id DESC;")
                filas = cursor.fetchall()
                
                clientes = []
                for fila in filas:
                    clientes.append({
                        "id": fila[0], "NIF": fila[1], "razonsocial": fila[2], "calle": fila[3],
                        "numero": fila[4], "piso": fila[5], "poblacion": fila[6], "provincia": fila[7],
                        "CP": fila[8], "telefono": fila[9], "observaciones": fila[10]
                    })
                return clientes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener clientes: {str(e)}")

# 3. OBTENER UN CLIENTE POR ID
@router.get("/{cliente_id}", response_model=ClienteResponse)
def obtener_cliente(cliente_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, NIF, razonsocial, calle, numero, piso, poblacion, provincia, CP, telefono, observaciones FROM cliente WHERE id = %s;", (cliente_id,))
            fila = cursor.fetchone()
            if not fila:
                raise HTTPException(status_code=404, detail="Cliente no encontrado")
            
            return {
                "id": fila[0], "NIF": fila[1], "razonsocial": fila[2], "calle": fila[3],
                "numero": fila[4], "piso": fila[5], "poblacion": fila[6], "provincia": fila[7],
                "CP": fila[8], "telefono": fila[9], "observaciones": fila[10]
            }

# 4. ELIMINAR UN CLIENTE
@router.delete("/{cliente_id}", status_code=status.HTTP_200_OK)
def eliminar_cliente(cliente_id: int, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Comprobar si existe
                cursor.execute("SELECT id FROM cliente WHERE id = %s;", (cliente_id,))
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                
                cursor.execute("DELETE FROM cliente WHERE id = %s;", (cliente_id,))
                conn.commit()
                return {"mensaje": f"Cliente con ID {cliente_id} eliminado correctamente"}
    except Exception as e:
        # Si el cliente ya tiene facturas, saltará la restricción RESTRICT que pusiste en SQL
        raise HTTPException(status_code=400, detail=f"No se puede eliminar el cliente. Motivo: {str(e)}")
    
# 5. ACTUALIZAR UN CLIENTE 
@router.put("/{cliente_id}", response_model=ClienteResponse)
def actualizar_cliente(cliente_id: int, cliente: ClienteCreate, usuario_actual: dict = Depends(obtener_usuario_actual)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # A. Validar que el cliente exista
                cursor.execute("SELECT id, NIF FROM cliente WHERE id = %s;", (cliente_id,))
                existente = cursor.fetchone()
                if not existente:
                    raise HTTPException(status_code=404, detail="Cliente no encontrado")
                
                nif_actual = existente[1]
                
                # B. Validar duplicado de NIF: si el NIF cambió, verificar que no pertenezca a OTRO cliente
                if cliente.NIF != nif_actual:
                    cursor.execute("SELECT id FROM cliente WHERE NIF = %s AND id != %s;", (cliente.NIF, cliente_id))
                    if cursor.fetchone():
                        raise HTTPException(status_code=400, detail="El NIF introducido ya está registrado en otro cliente")
                
                # C. Ejecutar la actualización en la tabla
                update_query = """
                    UPDATE cliente 
                    SET NIF = %s, razonsocial = %s, calle = %s, numero = %s, piso = %s, 
                        poblacion = %s, provincia = %s, CP = %s, telefono = %s, observaciones = %s
                    WHERE id = %s
                    RETURNING id, NIF, razonsocial, calle, numero, piso, poblacion, provincia, CP, telefono, observaciones;
                """
                cursor.execute(update_query, (
                    cliente.NIF, cliente.razonsocial, cliente.calle, cliente.numero, cliente.piso,
                    cliente.poblacion, cliente.provincia, cliente.CP, cliente.telefono, cliente.observaciones,
                    cliente_id
                ))
                
                actualizado = cursor.fetchone()
                conn.commit()
                
                return {
                    "id": actualizado[0], "NIF": actualizado[1], "razonsocial": actualizado[2], "calle": actualizado[3],
                    "numero": actualizado[4], "piso": actualizado[5], "poblacion": actualizado[6], "provincia": actualizado[7],
                    "CP": actualizado[8], "telefono": actualizado[9], "observaciones": actualizado[10]
                }
                
    except HTTPException as he:
        raise he  # Re-lanzamos las excepciones controladas de FastAPI (404, 400)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar cliente: {str(e)}")
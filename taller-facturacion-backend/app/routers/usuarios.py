from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm # <-- IMPORTANTE: Añade esta importación
from app.database import get_db_connection
from app.schemas.usuario import UsuarioCreate, UsuarioResponse
from app.auth.security import obtener_password_hash, verificar_password, crear_token_acceso

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/registro", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def registrar_usuario(usuario_in: UsuarioCreate):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 1. Comprobar si el usuario o email ya existen
                cursor.execute(
                    "SELECT id FROM usuario WHERE usuario = %s OR email = %s", 
                    (usuario_in.usuario, usuario_in.email)
                )
                if cursor.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El nombre de usuario o el email ya están registrados."
                    )
                
                # 2. Hashear la contraseña
                pwd_hashed = obtener_password_hash(usuario_in.password)
                
                # 3. Insertar en la base de datos
                query = """
                    INSERT INTO usuario (nombre, usuario, password, email, tipoUsuario, fechaNacimiento)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, nombre, usuario, email, tipoUsuario, fechaNacimiento;
                """
                cursor.execute(query, (
                    usuario_in.nombre,
                    usuario_in.usuario,
                    pwd_hashed,
                    usuario_in.email,
                    usuario_in.tipoUsuario.value, # Extraemos el valor de texto del Enum
                    usuario_in.fechaNacimiento
                ))
                
                nuevo_usuario = cursor.fetchone()
                conn.commit() # Confirmar transacción para guardar en disco
                
                # Mapeamos la tupla devuelta explícitamente convirtiendo el ENUM a string
                return {
                    "id": nuevo_usuario[0],
                    "nombre": nuevo_usuario[1],
                    "usuario": nuevo_usuario[2],
                    "email": nuevo_usuario[3],
                    "tipoUsuario": str(nuevo_usuario[4]), # Aseguramos que sea un string para Pydantic
                    "fechaNacimiento": nuevo_usuario[5]
                }
    except Exception as e:
        # Si hay cualquier error de base de datos, lo capturamos y lo mostramos en el cliente para saber qué es
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}"
        )

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            # Buscamos al usuario en la BD
            # Nota: form_data.username es el campo estándar donde viaja el nombre de usuario
            cursor.execute(
                "SELECT id, usuario, password, tipoUsuario FROM usuario WHERE usuario = %s;", 
                (form_data.username,)
            )
            user = cursor.fetchone()
            
            # Si no existe o la contraseña no coincide
            if not user or not verificar_password(form_data.password, user[2]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuario o contraseña incorrectos",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Si todo está bien, generamos el Token JWT
            token_data = {
                "sub": user[1],
                "id": user[0],
                "rol": str(user[3]) # Tipo de usuario (Admin, Operario, etc.)
            }
            token = crear_token_acceso(data=token_data)
            
            # Devolvemos el formato estándar que exige el candado de Swagger
            return {
                "access_token": token, 
                "token_type": "bearer"
            }
import os
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET", "una_clave_por_defecto_si_no_hay_env")
ALGORITHM = "HS256"

# Esto le dice a FastAPI que busque el token en la cabecera "Authorization: Bearer <TOKEN>"
# El parámetro tokenUrl apunta a nuestro endpoint de login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def obtener_usuario_actual(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales de acceso",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decodificamos el token con nuestra clave secreta
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        usuario: str = payload.get("sub")
        usuario_id: int = payload.get("id")
        rol: str = payload.get("rol")
        
        if usuario is None or usuario_id is None:
            raise credentials_exception
            
        # Devolvemos los datos del usuario logueado en un diccionario rápido
        return {"id": usuario_id, "usuario": usuario, "rol": rol}
        
    except jwt.PyJWTError:
        raise credentials_exception
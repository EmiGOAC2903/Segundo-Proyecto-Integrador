# main.py
# Backend de nuestra página tipo Pinterest
# API REST simple que devuelve y gestiona posts (imágenes tipo feed)

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

app = FastAPI(title="Pinterest-like Posts API")

# CORS para permitir que el frontend (localhost, etc.) acceda a la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # permite cualquier origen. Cambiar cuando tengamos dominio.
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Modelos de datos
# -----------------------------

class Post(BaseModel):
    id: int
    usuario: str                 # quién creó el post
    fecha_alta: datetime         # fecha de alta del post
    titulo: str
    imagen: str                  # URL de la imagen
    descripcion: Optional[str] = None
    url: Optional[str] = None    # link externo opcional
    tags: Optional[List[str]] = []
    alt: Optional[str] = None


class PostCreate(BaseModel):
    # Lo que recibe el backend al crear un post (sin id, sin usuario, sin fecha_alta)
    titulo: str
    imagen: str                  # URL de la imagen
    descripcion: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[List[str]] = []
    alt: Optional[str] = None


class PostUpdate(BaseModel):
    # Lo que se puede actualizar (todos opcionales)
    titulo: Optional[str] = None
    imagen: Optional[str] = None
    descripcion: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[List[str]] = None
    alt: Optional[str] = None


# -----------------------------
# "Base de datos" en memoria
# -----------------------------

DB: List[Post] = []
NEXT_ID = 1


def seed():
    """Semilla de datos iniciales para el feed."""
    global NEXT_ID, DB

    posts_iniciales = [
        Post(
            id=NEXT_ID,
            usuario="admin",
            fecha_alta=datetime(2025, 10, 24, 0, 0, 0),
            titulo="Atardecer en la ciudad",
            imagen="img-seed/city-sunset.jpg",
            descripcion="Un atardecer naranja en la ciudad con rascacielos.",
            url=None,
            tags=["ciudad", "atardecer", "paisaje"],
            alt="Foto de un atardecer en la ciudad"
        ),
        Post(
            id=NEXT_ID + 1,
            usuario="admin",
            fecha_alta=datetime(2025, 10, 24, 0, 1, 0),
            titulo="Café y estudio",
            imagen="img-seed/coffee-study.jpg",
            descripcion="Escritorio con una laptop, café y apuntes.",
            url=None,
            tags=["estudio", "café", "productividad"],
            alt="Taza de café junto a una laptop"
        ),
        Post(
            id=NEXT_ID + 2,
            usuario="tania",
            fecha_alta=datetime(2025, 10, 23, 0, 0, 0),
            titulo="Paisaje de montaña",
            imagen="img-seed/mountain-landscape.jpg",
            descripcion="Montañas nevadas y un lago tranquilo.",
            url=None,
            tags=["montaña", "naturaleza", "viaje"],
            alt="Montañas nevadas frente a un lago"
        ),
        Post(
            id=NEXT_ID + 3,
            usuario="tania",
            fecha_alta=datetime(2025, 10, 22, 0, 0, 0),
            titulo="Setup minimalista",
            imagen="img-seed/minimal-setup.jpg",
            descripcion="Escritorio minimalista con monitor y accesorios.",
            url=None,
            tags=["setup", "minimalismo", "tecnología"],
            alt="Escritorio minimalista con monitor"
        ),
    ]

    DB.extend(posts_iniciales)
    NEXT_ID += len(posts_iniciales)


seed()

# -----------------------------
# Endpoints
# -----------------------------

@app.get("/")
def health():
    """Endpoint simple para verificar que la API está viva."""
    return {"ok": True, "count": len(DB)}


@app.get("/api/posts", response_model=List[Post])
def listar_posts(
    skip: int = 0,
    limit: int = 10,
    min_date: Optional[str] = None
):
    if skip < 0:
        skip = 0
    if limit <= 0:
        limit = 10

    posts = DB
    
    # !! TO DO: Filtrar por min_date si se proporciona
    """
    if min_date is not None:
        try:
            parsed = datetime.fromisoformat(min_date.replace("Z", "+00:00"))
            parsed_naive = parsed.replace(tzinfo=None)
            posts = [p for p in posts if p.fecha_alta >= parsed_naive]
        except Exception:
            # si no se pudo parsear min_date, seguimos sin filtro
            pass
    """       
    return posts[skip: skip + limit]



@app.get("/api/posts/{post_id}", response_model=Post)
def obtener_post(post_id: int):
    """Obtiene un solo post por id."""
    for p in DB:
        if p.id == post_id:
            return p
    raise HTTPException(status_code=404, detail="Post no encontrado")


@app.post("/api/posts", response_model=Post)
def crear_post(
    post_in: PostCreate,
    x_user: str = Header(..., alias="X-User")
):
    """
    Crea un nuevo post.
    - El usuario que lo crea viene en el header X-User.
    - La fecha_alta la pone el servidor (UTC).
    """
    global NEXT_ID, DB

    if not post_in.titulo:
        raise HTTPException(status_code=400, detail="El título es obligatorio")
    if not post_in.imagen:
        raise HTTPException(status_code=400, detail="La imagen es obligatoria")

    post = Post(
        id=NEXT_ID,
        usuario=x_user,
        fecha_alta=datetime.utcnow(),
        titulo=post_in.titulo,
        imagen=post_in.imagen,
        descripcion=post_in.descripcion,
        url=post_in.url,
        tags=post_in.tags,
        alt=post_in.alt or post_in.titulo
    )
    NEXT_ID += 1
    DB.append(post)
    return post


@app.put("/api/posts/{post_id}", response_model=Post)
def actualizar_post(
    post_id: int,
    post_in: PostUpdate,
    x_user: str = Header(..., alias="X-User")
):
    """
    Actualiza un post existente.
    Solo puede hacerlo el usuario que lo creó (usuario == X-User).
    """
    for i, post in enumerate(DB):
        if post.id == post_id:
            # Validar propietario
            if post.usuario != x_user:
                raise HTTPException(status_code=403, detail="No puedes modificar este post")

            data = post.model_dump()
            if post_in.titulo is not None:
                data["titulo"] = post_in.titulo
            if post_in.imagen is not None:
                data["imagen"] = post_in.imagen
            if post_in.descripcion is not None:
                data["descripcion"] = post_in.descripcion
            if post_in.url is not None:
                data["url"] = post_in.url
            if post_in.tags is not None:
                data["tags"] = post_in.tags
            if post_in.alt is not None:
                data["alt"] = post_in.alt

            post_actualizado = Post(**data)
            DB[i] = post_actualizado
            return post_actualizado

    raise HTTPException(status_code=404, detail="Post no encontrado")


@app.delete("/api/posts/{post_id}", status_code=204)
def eliminar_post(
    post_id: int,
    x_user: str = Header(..., alias="X-User")
):
    """
    Elimina un post.
    Solo puede hacerlo el usuario que lo creó (usuario == X-User).
    """
    for i, post in enumerate(DB):
        if post.id == post_id:
            if post.usuario != x_user:
                raise HTTPException(status_code=403, detail="No puedes eliminar este post")
            DB.pop(i)
            return

    raise HTTPException(status_code=404, detail="Post no encontrado")

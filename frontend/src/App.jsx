import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./App.css";

// ---------------------- CONFIG API ----------------------
const isLocal =
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "localhost";

/*const API = isLocal
  ? "http://127.0.0.1:8000"
  : "http://127.0.0.1:8000"; // cambiar por dominio cuando esté en producción */

const API = "http://localhost:8000"; // backend FastAPI

function getUsuarioActual() {
  return sessionStorage.getItem("usuarioActual") || "anon";
}

// ---------------------- CARD ----------------------
function PostCard({ post, onEdit, onDelete, usuarioActual }) {
  const fecha = new Date(post.fecha_alta || post.fecha || post.timestamp);
  const when = fecha.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const tags = (post.tags || []).map((t) => (
    <span key={t} className="badge rounded-pill text-bg-secondary me-1">
      {t}
    </span>
  ));

  const hasImage = post.imagen && post.imagen.trim() !== "";
  const img = hasImage ? (
    <img
      src={post.imagen}
      className="card-img-top"
      alt={post.alt || post.titulo}
      loading="lazy"
      onError={(e) => {
        console.warn("Imagen no encontrada:", e.currentTarget.src);
        e.currentTarget.remove();
      }}
    />
  ) : null;

  const content = post.url ? (
    <a href={post.url} target="_blank" rel="noopener noreferrer">
      {img}
    </a>
  ) : (
    img
  );

  const esMio = (post.usuario || "").trim() === (usuarioActual || "").trim();

  return (
    <div className="card bg-dark text-light border-0">
      {content}

      <div className="card-body">
        <h5 className="card-title">{post.titulo}</h5>

        <p className="small text-muted">
          {when} · Publicado por: <strong>{post.usuario}</strong>
        </p>

        {post.descripcion && <p className="card-text">{post.descripcion}</p>}

        <div className="d-flex justify-content-center align-items-center gap-2 flex-wrap">
          {post.url && (
            <a
              href={post.url}
              className="btn btn-success btn-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver más
            </a>
          )}

          {esMio && (
            <button
              className="btn btn-outline-warning btn-sm"
              onClick={() => onEdit && onEdit(post)}
            >
              Editar
            </button>
          )}

          {esMio && (
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => onDelete && onDelete(post)}
            >
              Eliminar
            </button>
          )}
        </div>

        {tags.length > 0 && <div className="mt-2">{tags}</div>}
      </div>
    </div>
  );
}

// ---------------------- USER SELECTOR ----------------------
function UserSelector({ usuarioActual, setUsuarioActual }) {
  const [input, setInput] = useState("");

  useEffect(() => {
    setInput(usuarioActual === "anon" ? "" : usuarioActual);
  }, [usuarioActual]);

  function actualizarUsuario() {
    const nombre = input.trim();

    if (nombre) {
      sessionStorage.setItem("usuarioActual", nombre);
      setUsuarioActual(nombre); 
    } else {
      sessionStorage.removeItem("usuarioActual");
      setUsuarioActual("anon");
    }
  }

  return (
    <section className="mb-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          actualizarUsuario();
        }}
      >
        <div className="row g-2 align-items-center">
          <div className="col-sm-6 col-md-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="form-control form-control-sm bg-dark text-light border-secondary"
              placeholder="nombre de usuario (ej. tania)"
            />
          </div>

          <div className="col-sm-6 col-md-4">
            <button type="submit" className="btn btn-sm btn-success">
              Usar este usuario
            </button>
          </div>

          <div className="col-12 mt-2">
            <small className="text-muted">
              Usuario actual: <strong>{usuarioActual}</strong>
            </small>
          </div>
        </div>
      </form>
    </section>
  );
}

// ---------------------- BUSCAR POR ID ----------------------
function SearchById({ onResult }) {
  const [id, setId] = useState("");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanId = id.trim();
    if (!cleanId) return;

    try {
      setMsg("Buscando post...");
      const res = await fetch(`${API}/api/posts/${cleanId}`);

      if (res.status === 404) {
        setMsg("Post no encontrado");
        onResult(null);
        return;
      }

      if (!res.ok) throw new Error("Error al obtener el post");
      const post = await res.json();
      onResult(post);
      setMsg("Post cargado correctamente.");
    } catch (err) {
      console.error(err);
      setMsg("Error al consultar el post.");
      onResult(null);
    }
  }

  return (
    <section id="buscar" className="mb-4">
      <div className="pm-panel">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <h2 className="pm-section-title mb-0">Buscar post por ID</h2>
          <span className="pm-hint">Encuentra un post específico por su ID</span>
        </div>

        <form onSubmit={handleSubmit} className="pm-searchbar">
          <div className="input-group input-group-sm">
            <span className="input-group-text pm-input-addon">#</span>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="form-control bg-dark text-light border-secondary pm-input"
              placeholder="Ej. 2"
              value={id}
              onChange={(e) => setId(e.target.value.replace(/\D/g, ""))}
            />

            <button type="submit" className="btn btn-primary pm-btn-primary">
              Buscar
            </button>
          </div>
        </form>

        {msg && <p className="pm-msg small mt-2 mb-0">{msg}</p>}
      </div>
    </section>
  );
}

// ---------------------- CREAR POST ----------------------
function CreatePostForm({ onCreated }) {
  const [titulo, setTitulo] = useState("");
  const [imagen, setImagen] = useState("");
  const [url, setUrl] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [msg, setMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSaving) return;

    const cleanTitulo = titulo.trim();
    const cleanImagen = imagen.trim();
    const cleanUrl = url.trim() || null;
    const cleanDesc = descripcion.trim() || null;

    const tags =
      tagsStr.trim() === ""
        ? []
        : tagsStr
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);

    if (!cleanTitulo || !cleanImagen) {
      setMsg("El título y la URL de la imagen son obligatorios.");
      return;
    }

    const nuevoPost = {
      titulo: cleanTitulo,
      imagen: cleanImagen,
      descripcion: cleanDesc,
      url: cleanUrl,
      tags,
      alt: cleanTitulo,
    };

    const usuarioActual = getUsuarioActual();

    try {
      setMsg("Guardando post...");
      setIsSaving(true);

      const res = await fetch(`${API}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User": usuarioActual,
        },
        body: JSON.stringify(nuevoPost),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Error backend:", errText);
        setMsg("Error al guardar el post.");
        return;
      }

      setTitulo("");
      setImagen("");
      setUrl("");
      setDescripcion("");
      setTagsStr("");

      setMsg("Post guardado correctamente.");
      onCreated && onCreated();
    } catch (err) {
      console.error(err);
      setMsg("No se pudo guardar el post.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section id="crear" className="mb-5">
      <div className="pm-panel">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h2 className="pm-section-title mb-0">Crear nuevo post</h2>
          <span className="pm-hint">Comparte una imagen con título y descripción</span>
        </div>

        <form onSubmit={handleSubmit} className="row g-3">
          <div className="col-md-4">
            <label className="form-label small">Título</label>
            <input
              className="form-control form-control-sm bg-dark text-light border-secondary"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </div>

          <div className="col-md-4">
            <label className="form-label small">URL de imagen</label>
            <input
              className="form-control form-control-sm bg-dark text-light border-secondary"
              placeholder="https://..."
              value={imagen}
              onChange={(e) => setImagen(e.target.value)}
              required
            />
          </div>

          <div className="col-md-4">
            <label className="form-label small">Link externo (opcional)</label>
            <input
              className="form-control form-control-sm bg-dark text-light border-secondary"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="col-12">
            <label className="form-label small">Descripción (opcional)</label>
            <textarea
              rows="2"
              className="form-control form-control-sm bg-dark text-light border-secondary"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="col-12">
            <label className="form-label small">Etiquetas (coma)</label>
            <input
              className="form-control form-control-sm bg-dark text-light border-secondary"
              placeholder="viaje, paisaje"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
            />
          </div>

          <div className="col-12 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <button type="submit" className="btn btn-sm btn-success" disabled={isSaving}>
              {isSaving ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Guardando...
                </>
              ) : (
                "Guardar post"
              )}
            </button>

            {msg && <span className="pm-msg small">{msg}</span>}
          </div>
        </form>
      </div>
    </section>
  );
}

// ---------------------- ACTUALIZAR POST ----------------------
function UpdatePostForm({ onUpdated, editingPost, clearEditing }) {
  const [editingId, setEditingId] = useState(null);

  const [titulo, setTitulo] = useState("");
  const [imagen, setImagen] = useState("");
  const [url, setUrl] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [msg, setMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editingPost) return;

    setEditingId(editingPost.id);
    setTitulo(editingPost.titulo || "");
    setImagen(editingPost.imagen || "");
    setUrl(editingPost.url || "");
    setDescripcion(editingPost.descripcion || "");
    setTagsStr(Array.isArray(editingPost.tags) ? editingPost.tags.join(", ") : "");

    setMsg(`Editando post #${editingPost.id}`);
  }, [editingPost]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSaving) return;

    const postId = editingId;
    if (!postId) {
      setMsg("Selecciona un post para editar (usa el botón Editar).");
      return;
    }

    const body = {};
    if (titulo.trim()) body.titulo = titulo.trim();
    if (imagen.trim()) body.imagen = imagen.trim();
    if (url.trim()) body.url = url.trim();
    if (descripcion.trim()) body.descripcion = descripcion.trim();
    if (tagsStr.trim()) {
      body.tags = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }

    const usuarioActual = getUsuarioActual();

    try {
      setMsg("Actualizando post...");
      setIsSaving(true);

      const res = await fetch(`${API}/api/posts/${postId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User": usuarioActual,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        setMsg("No tienes permisos para modificar este post.");
        return;
      }

      if (res.status === 404) {
        setMsg("Post no encontrado.");
        return;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error("Error backend:", errText);
        setMsg("Error al actualizar el post.");
        return;
      }

      setEditingId(null);
      clearEditing && clearEditing();

      setTitulo("");
      setImagen("");
      setUrl("");
      setDescripcion("");
      setTagsStr("");

      setMsg("Post actualizado.");
      onUpdated && onUpdated();
    } catch (err) {
      console.error(err);
      setMsg("No se pudo actualizar el post.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section id="editar" className="mb-5">
      <div className="pm-panel pm-panel-edit">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h2 className="pm-section-title mb-1">
              Actualizar post {editingId ? `#${editingId}` : ""}
            </h2>
            <div className="pm-hint">
              {editingId
                ? "Modifica los campos que quieras y guarda cambios."
                : "Selecciona un post para editar."}
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                setEditingId(null);
                clearEditing && clearEditing();
                setTitulo("");
                setImagen("");
                setUrl("");
                setDescripcion("");
                setTagsStr("");
                setMsg("Edición cancelada.");
              }}
              disabled={isSaving}
            >
              Cancelar
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="row g-3">
          <div className="col-md-4">
            <label className="form-label small">Título (opcional)</label>
            <input
              className="form-control form-control-sm bg-dark text-light border-secondary"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>

          <div className="col-md-4">
            <label className="form-label small">URL de imagen (opcional)</label>
            <input
              className="form-control form-control-sm bg-dark text-light border-secondary"
              placeholder="https://..."
              value={imagen}
              onChange={(e) => setImagen(e.target.value)}
            />
          </div>

          <div className="col-md-4">
            <label className="form-label small">Link externo (opcional)</label>
            <input
              className="form-control form-control-sm bg-dark text-light border-secondary"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="col-12">
            <label className="form-label small">Descripción (opcional)</label>
            <textarea
              rows="2"
              className="form-control form-control-sm bg-dark text-light border-secondary"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div className="col-12">
            <label className="form-label small">Etiquetas (coma, opcional)</label>
            <input
              className="form-control form-control-sm bg-dark text-light border-secondary"
              placeholder="viaje, paisaje"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
            />
          </div>

          <div className="col-12 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <button type="submit" className="btn btn-sm btn-warning" disabled={isSaving}>
              {isSaving ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Actualizando...
                </>
              ) : (
                "Actualizar post"
              )}
            </button>

            {msg && <span className="pm-msg small">{msg}</span>}
          </div>
        </form>
      </div>
    </section>
  );
}

// ---------------------- FEED PAGE ----------------------
function FeedPage() {
  const location = useLocation();

  const [paginaActual, setPaginaActual] = useState(0);
  const [posts, setPosts] = useState([]);
  const [msg, setMsg] = useState("Cargando...");
  const [busquedaPost, setBusquedaPost] = useState(null);

  const [editingPost, setEditingPost] = useState(null);

  const [usuarioActual, setUsuarioActual] = useState(getUsuarioActual());

  const limit = 9;

  useEffect(() => {
    cargar(paginaActual);
  }, [paginaActual]);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace("#", "");
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  useEffect(() => {
    if (!editingPost) return;
    requestAnimationFrame(() => {
      const el = document.getElementById("editar");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [editingPost]);

  async function cargar(pagina = 0) {
    pagina = Number(pagina) || 0;
    const skip = pagina * limit;

    const url = `${API}/api/posts?skip=${skip}&limit=${limit}`;

    try {
      setMsg("Cargando posts...");

      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al obtener posts");

      const data = await res.json();
      setPosts(data);
      setMsg(`Página ${pagina + 1} (${data.length} posts cargados)`);
    } catch (e) {
      console.error(e);
      setMsg("No se pudieron cargar los posts.");
    }
  }

  function startEdit(post) {
    setEditingPost(post);
  }

  function clearEditing() {
    setEditingPost(null);
  }

  async function handleDelete(post) {
    const ok = window.confirm(`¿Eliminar el post #${post.id}?`);
    if (!ok) return;

    try {
      const res = await fetch(`${API}/api/posts/${post.id}`, {
        method: "DELETE",
        headers: {
          "X-User": usuarioActual,
        },
      });

      if (res.status === 403) {
        alert("No tienes permisos para eliminar este post.");
        return;
      }

      if (res.status === 404) {
        alert("Post no encontrado.");
        return;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error("Error backend:", errText);
        alert("Error al eliminar el post.");
        return;
      }

      if (editingPost?.id === post.id) clearEditing();

      await cargar(paginaActual);
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar el post.");
    }
  }

  return (
    <>
      <UserSelector usuarioActual={usuarioActual} setUsuarioActual={setUsuarioActual} />

      <section className="mb-2">
        <p className="text-muted small">{msg}</p>
      </section>

      <section className="mb-2">
        {posts.length === 0 ? (
          <div className="pm-empty">
            <div className="pm-empty-title">Aún no hay posts</div>
            <div className="pm-empty-sub">Crea el primero en “Crear nuevo post”.</div>
          </div>
        ) : (
          <div className="pm-masonry">
            {posts.map((post) => (
              <div className="pm-masonry-item" key={post.id}>
                <PostCard
                  post={post}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                  usuarioActual={usuarioActual}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-4">
        <div className="d-flex justify-content-center gap-2">
          <button
            className="btn btn-outline-light btn-sm"
            onClick={() => setPaginaActual((p) => (p > 0 ? p - 1 : 0))}
            disabled={paginaActual === 0}
          >
            Anterior
          </button>

          <button className="btn btn-outline-light btn-sm" onClick={() => setPaginaActual((p) => p + 1)}>
            Siguiente
          </button>

          <button className="btn btn-outline-success btn-sm" onClick={() => cargar(paginaActual)}>
            Recargar
          </button>
        </div>
      </section>

      <hr className="border-secondary" />

      <SearchById onResult={setBusquedaPost} />

      {busquedaPost && (
        <div className="mt-3 mb-4">
          <div className="pm-masonry pm-masonry-1">
            <div className="pm-masonry-item">
              <PostCard
                post={busquedaPost}
                onEdit={startEdit}
                onDelete={handleDelete}
                usuarioActual={usuarioActual}
              />
            </div>
          </div>
        </div>
      )}

      <hr className="border-secondary" />

      <CreatePostForm onCreated={() => cargar(paginaActual)} />

      {editingPost && (
        <>
          <hr className="border-secondary" />

          <UpdatePostForm
            onUpdated={() => cargar(paginaActual)}
            editingPost={editingPost}
            clearEditing={clearEditing}
          />
        </>
      )}
    </>
  );
}

// ---------------------- DISCOVER HELPERS ----------------------
function makeShortTitle(text) {
  if (!text) return "Imagen de Unsplash";

  let t = text.replace(/https?:\/\/\S+/g, "").trim();
  t = t.split(/[()\-|•·]/)[0].trim();

  const MAX = 60;
  if (t.length > MAX) t = t.slice(0, MAX - 3).trim() + "...";

  return t || "Imagen de Unsplash";
}

function unsplashToPost(img) {
  const desc = img.descripcion || "Imagen de Unsplash";
  const tituloCorto = makeShortTitle(desc);

  return {
    id: img.id,
    titulo: tituloCorto,
    fecha_alta: new Date().toISOString(),
    usuario: `${img.autor} (Unsplash)`,
    imagen: img.url_imagen,
    descripcion: desc,
    url: img.url_full,
    tags: ["unsplash"],
    alt: desc,
  };
}

// ---------------------- DISCOVER PAGE ----------------------
function DiscoverPage() {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(0);
  const [msg, setMsg] = useState("Cargando imágenes...");
  const [isLoading, setIsLoading] = useState(false);

  const DISCOVER_CHUNK = 9;

  async function cargar({ append } = { append: false }) {
    if (isLoading) return;

    const count = DISCOVER_CHUNK;

    try {
      setIsLoading(true);
      setMsg("Cargando imágenes de Unsplash...");

      const res = await fetch(`${API}/api/discover?count=${count}`);
      if (!res.ok) {
        setMsg("Error al obtener imágenes de Unsplash.");
        return;
      }

      const data = await res.json();
      const posts = data.map(unsplashToPost);

      setItems((prev) => (append ? [...prev, ...posts] : posts));

      const nuevoTotal = append ? loaded + data.length : data.length;
      setLoaded(nuevoTotal);

      setMsg(`Se han cargado ${nuevoTotal} imágenes.`);
    } catch (err) {
      console.error(err);
      setMsg("No se pudieron cargar las imágenes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    cargar({ append: false });
  }, []);

  function handleReload() {
    setItems([]);
    setLoaded(0);
    cargar({ append: false });
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <button
          id="btnDiscoverReload"
          className="btn btn-sm btn-outline-light"
          onClick={handleReload}
          disabled={isLoading}
        >
          Recargar imágenes
        </button>
      </div>

      <p id="msg-discover" className="text-muted small mb-2">
        {msg}
      </p>

      <section className="mb-3">
        {items.length === 0 && isLoading ? (
          <div className="pm-empty">
            <div className="pm-empty-title">Cargando imágenes…</div>
            <div className="pm-empty-sub">Un segundo, ya casi.</div>
          </div>
        ) : items.length === 0 ? (
          <div className="pm-empty">
            <div className="pm-empty-title">Sin resultados</div>
            <div className="pm-empty-sub">Prueba “Recargar imágenes”.</div>
          </div>
        ) : (
          <div className="pm-masonry">
            {items.map((post) => (
              <div className="pm-masonry-item" key={post.id}>
                <PostCard post={post} onEdit={null} onDelete={null} usuarioActual="__none__" />
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="text-center mt-3 mb-4">
        <button
          id="btnDiscoverLoad"
          className="btn btn-sm btn-outline-light"
          onClick={() => cargar({ append: true })}
          disabled={isLoading}
        >
          Cargar más
        </button>
      </div>
    </>
  );
}

// --------------------- Botones flotantes -----------------
function Switcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDiscover = location.pathname === "/discover";

  const goFeed = () => {
    if (isDiscover) navigate("/");
    else window.location.reload();
  };

  const goDiscover = () => {
    if (isDiscover) window.location.reload();
    else navigate("/discover");
  };

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "16px",
        transform: "translateX(-50%)",
        zIndex: 1000,
      }}
    >
      <div className="btn-group">
        <button onClick={goFeed} className="btn btn-sm pm-float-toggle">
          Feed
        </button>
        <button onClick={goDiscover} className="btn btn-sm pm-float-toggle">
          Discover
        </button>
      </div>
    </div>
  );
}

// ---------------------- BACK TO TOP ----------------------
function BackToTopButton() {
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <button
      onClick={scrollTop}
      className="btn position-fixed bottom-0 end-0 m-4 shadow pm-to-top"
      style={{
        width: "34px",
        height: "34px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--pm-teal)",
        borderColor: "var(--pm-teal)",
        color: "#fff",
        borderRadius: "10px",
      }}
      aria-label="Scroll to top"
      title="Arriba"
    >
      ^
    </button>
  );
}

// ---------------------- NAVBAR ----------------------
function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDiscover = location.pathname === "/discover";

  const pageLabel = isDiscover ? "Discover" : "Feed";

  return (
    <nav className="navbar navbar-expand-lg navbar-dark pc-navbar fixed-top shadow-sm">
      <div className="container position-relative">
        <button
          className="navbar-brand btn btn-link text-decoration-none text-light p-0 pc-brand d-flex align-items-center gap-2"
          onClick={() => navigate("/")}
          type="button"
        >
          <img src="/logo.png" alt="PixelMind logo" className="pc-logo" />
          <span>PixelMind</span>
        </button>

        <div className="pc-nav-center-title d-none d-md-block">{pageLabel}</div>

        <button
          className="navbar-toggler ms-auto"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#pcNav"
          aria-controls="pcNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse" id="pcNav">
          {!isDiscover && (
            <div className="ms-auto d-flex gap-2 mt-3 mt-lg-0 flex-wrap align-items-lg-center">
              <button className="btn pc-pill btn-sm" onClick={() => navigate("/#crear")}>
                Nuevo Post
              </button>

              <button className="btn pc-pill btn-sm" onClick={() => navigate("/#buscar")}>
                Buscar por ID
              </button>
            </div>
          )}

          <div className="d-md-none text-center mt-3 w-100">
            <div className="pc-nav-center-title">{pageLabel}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ---------------------- APP PRINCIPAL ----------------------
export default function App() {
  return (
    <>
      <TopNav />

      <div className="pm-shell min-vh-100 pc-main">
        <main className="container-fluid px-4 py-4">
          <Routes>
            <Route path="/" element={<FeedPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
          </Routes>
        </main>

        <Switcher />
        <BackToTopButton />
      </div>
    </>
  );
}
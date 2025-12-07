// api.js
document.addEventListener('DOMContentLoaded', () => {
  const isLocal = location.hostname === "127.0.0.1" 
               || location.hostname === "localhost";

  const API = isLocal
    ? "http://127.0.0.1:8000"      // cuando estoy probando en mi compu
    : "http://127.0.0.1:8000";     // cambiar por dominio cuando esté en producción
    
  const $ = (id) => document.getElementById(id);

  const $msg        = $("msg");                 // mensajes al usuario (general)
  const $btn        = $("btnRecargar");
  const $lista      = $("contenedor-noticias"); // contenedor del feed
  const $form       = $("form-alerta");         // form crear post
  const $formEdit   = $("form-actualizar");     // form actualizar post
  const $formBuscar = $("form-buscar");

  // mensajes por sección (con fallback al msg general si existe)
  const $msgFeed   = $("msg-feed")   || $msg;
  const $msgCreate = $("msg-create") || $msg;
  const $msgEdit   = $("msg-edit")   || $msg;

  // ---- elementos para discover (si existen en esta página) ----
  const $discoverContainer = $("discover-contenido");
  const $msgDiscover       = $("msg-discover");
  const $btnDiscoverLoad   = $("btnDiscoverLoad");   // botón "Cargar más"
  const $btnDiscoverReload = $("btnDiscoverReload"); // botón "Recargar imágenes"

  // claves para localStorage
  const LS_FEED_DATA = "feed_cache_posts";
  const LS_FEED_TS   = "feed_last_fetch";

  // página actual para la paginación del feed
  let paginaActual = 0;

  // discover: cuántas imágenes llevamos y límites
  let discoverLoaded   = 0;
  const DISCOVER_MAX   = 27; // máximo total de imágenes en discover
  const DISCOVER_CHUNK = 9;  // cuántas por “cargar más”

  // -------------------------
  // Helpers
  // -------------------------

  function getUsuarioActual() {
    // Lo ideal: tener un form que guarde esto en sessionStorage.
    // Mientras, si no existe, usamos "anon".
    return sessionStorage.getItem("usuarioActual") || "anon";
  }

  // convierte un post en tarjeta HTML
  function card(post) {
    const fecha = new Date(post.fecha_alta || post.fecha || post.timestamp);
    const when  = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

    const tags = (post.tags || [])
      .map(t => `<span class="badge rounded-pill text-bg-secondary me-1">${t}</span>`)
      .join(" ");

    const imgHtml = post.imagen && post.imagen.trim() !== ""
      ? `<img src="${post.imagen}"
              class="card-img-top"
              alt="${post.alt || post.titulo}"
              onerror="console.warn('Imagen no encontrada:', this.src); this.remove();">`
      : "";

    return `
      <div class="col-12 col-sm-6 col-lg-4">
        <div class="card bg-dark text-light border-0 h-100">
          ${post.url
            ? `<a href="${post.url}" target="_blank" rel="noopener">${imgHtml}</a>`
            : imgHtml
          }
          <div class="card-body">
            <h5 class="card-title">${post.titulo}</h5>
            <p class="small text-muted">
              ${when} &middot; Publicado por: <strong>${post.usuario}</strong>
            </p>
            ${post.descripcion ? `<p class="card-text">${post.descripcion}</p>` : ""}
            ${post.url ? `<a href="${post.url}" class="btn btn-success btn-sm" target="_blank" rel="noopener">Ver más</a>` : ""}
            ${tags ? `<div class="mt-2">${tags}</div>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  // -------------------------
  // Cargar feed (con paginación)
  // -------------------------
  async function cargar(pagina = 0) {
    pagina = Number(pagina) || 0;
    const limit = 9;
    const skip  = pagina * limit;

    const lastFetch = localStorage.getItem(LS_FEED_TS);
    const hasCache  = !!localStorage.getItem(LS_FEED_DATA) && !!lastFetch;

    // Construir URL con skip/limit
    let url = `${API}/api/posts?skip=${skip}&limit=${limit}`;

    // !! TO DO: Manejar lo de los posts nuevos con min_date
    //if (hasCache) {
    //  url += `&min_date=${encodeURIComponent(lastFetch)}`;
    //}

    try {
      $msgFeed && ($msgFeed.textContent = hasCache
        ? "Cargando posts nuevos desde la última visita..."
        : "Cargando posts...");

      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al obtener posts");

      const data = await res.json();
      const tarjetas = data.map(card).join("");

      if ($lista) {
        $lista.innerHTML = `
          <div class="row g-3 mb-3">
            ${tarjetas}
          </div>
        `;
      }

      $msgFeed && ($msgFeed.textContent = `Página ${pagina + 1} (${data.length} posts cargados)`);

      // Guardar en localStorage: posts de esta página y timestamp actual
      localStorage.setItem(LS_FEED_DATA, JSON.stringify(data));
      localStorage.setItem(LS_FEED_TS, new Date().toISOString());
    } catch (e) {
      console.error(e);
      $msgFeed && ($msgFeed.textContent = "No se pudieron cargar los posts.");
    }
  }

  // -------------------------
  // Buscar por ID
  // -------------------------
  async function buscarPorId(id) {
    const $resultado = document.getElementById("resultado");
    const $msgBuscar = document.getElementById("msg-buscar") || $msgFeed;

    try {
      $msgBuscar && ($msgBuscar.textContent = "Buscando post...");
      const res = await fetch(`${API}/api/posts/${id}`);

      if (res.status === 404) {
        $msgBuscar && ($msgBuscar.textContent = "Post no encontrado");
        if ($resultado) $resultado.innerHTML = "";
        return;
      }

      if (!res.ok) throw new Error("Error al obtener el post");

      const post = await res.json();

      if ($resultado) {
        $resultado.innerHTML = `
          <div class="card mt-3 bg-dark text-light border-success-subtle">
            <div class="card-body">
              <h5>${post.titulo}</h5>
              <p>${post.descripcion || "Sin descripción"}</p>
              <small class="text-muted">
                Publicado por: <strong>${post.usuario}</strong>
              </small>
            </div>
          </div>
        `;
      }
      $msgBuscar && ($msgBuscar.textContent = "Post cargado correctamente.");
    } catch (e) {
      console.error(e);
      $msgBuscar && ($msgBuscar.textContent = "Error al consultar el post.");
    }
  }

  // -------------------------
  // Crear nuevo post
  // -------------------------
  if ($form) {
    $form.addEventListener("submit", async (evt) => {
      evt.preventDefault();

      const titulo      = $("titulo").value.trim();
      const url         = $("url").value.trim() || null;
      const descripcion = $("descripcion").value.trim() || null;
      const imagen      = $("imagen").value.trim() || null;
      const tagsStr     = $("tags").value.trim();

      const tags = tagsStr
        ? tagsStr.split(",").map(t => t.trim()).filter(t => t.length > 0)
        : [];

      if (!titulo || !imagen) {
        $msgCreate && ($msgCreate.textContent = "El título y la URL de la imagen son obligatorios.");
        return;
      }

      const nuevoPost = {
        titulo: titulo,
        imagen: imagen,
        descripcion: descripcion,
        url: url,
        tags: tags,
        alt: titulo
      };

      const usuarioActual = getUsuarioActual();

      try {
        $msgCreate && ($msgCreate.textContent = "Guardando post...");
        const res = await fetch(`${API}/api/posts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User": usuarioActual
          },
          body: JSON.stringify(nuevoPost)
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("Error backend:", errText);
          $msgCreate && ($msgCreate.textContent = "Error al guardar el post.");
          return;
        }

        $form.reset();
        $msgCreate && ($msgCreate.textContent = "Post guardado correctamente.");

        cargar(paginaActual);
      } catch (e) {
        console.error(e);
        $msgCreate && ($msgCreate.textContent = "No se pudo guardar el post.");
      }
    });
  }

  // -------------------------
  // Actualizar post existente
  // -------------------------
  if ($formEdit) {
    $formEdit.addEventListener("submit", async (evt) => {
      evt.preventDefault();

      const id          = Number($("edit-id").value);
      const titulo      = $("edit-titulo").value.trim();
      const url         = $("edit-url").value.trim();
      const descripcion = $("edit-descripcion").value.trim();
      const imagen      = $("edit-imagen").value.trim();
      const tagsStr     = $("edit-tags").value.trim();

      const body = {};

      if (titulo)      body.titulo = titulo;
      if (url)         body.url = url;
      if (descripcion) body.descripcion = descripcion;
      if (imagen)      body.imagen = imagen;
      if (tagsStr) {
        body.tags = tagsStr.split(",").map(t => t.trim()).filter(t => t.length > 0);
      }

      if (!id) {
        $msgEdit && ($msgEdit.textContent = "Debes indicar el ID del post a actualizar.");
        return;
      }

      const usuarioActual = getUsuarioActual();

      try {
        $msgEdit && ($msgEdit.textContent = "Actualizando post...");
        const res = await fetch(`${API}/api/posts/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User": usuarioActual
          },
          body: JSON.stringify(body)
        });

        if (res.status === 403) {
          $msgEdit && ($msgEdit.textContent = "No tienes permisos para modificar este post.");
          return;
        }

        if (res.status === 404) {
          $msgEdit && ($msgEdit.textContent = "Post no encontrado.");
          return;
        }

        if (!res.ok) {
          const errText = await res.text();
          console.error("Error backend:", errText);
          $msgEdit && ($msgEdit.textContent = "Error al actualizar el post.");
          return;
        }

        $formEdit.reset();
        $msgEdit && ($msgEdit.textContent = "Post actualizado.");
        cargar(paginaActual);
      } catch (e) {
        console.error(e);
        $msgEdit && ($msgEdit.textContent = "No se pudo actualizar el post.");
      }
    });
  }

  // -------------------------
  // (Opcional) función para eliminar post
  // -------------------------
  async function eliminarPost(id) {
    const usuarioActual = getUsuarioActual();
    try {
      $msgFeed && ($msgFeed.textContent = "Eliminando post...");
      const res = await fetch(`${API}/api/posts/${id}`, {
        method: "DELETE",
        headers: {
          "X-User": usuarioActual
        }
      });

      if (res.status === 403) {
        $msgFeed && ($msgFeed.textContent = "No tienes permisos para eliminar este post.");
        return;
      }

      if (res.status === 404) {
        $msgFeed && ($msgFeed.textContent = "Post no encontrado.");
        return;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error("Error backend:", errText);
        $msgFeed && ($msgFeed.textContent = "Error al eliminar el post.");
        return;
      }

      $msgFeed && ($msgFeed.textContent = "Post eliminado correctamente.");
      cargar(paginaActual);
    } catch (e) {
      console.error(e);
      $msgFeed && ($msgFeed.textContent = "No se pudo eliminar el post.");
    }
  }

  // -------------------------
  // Discover (Unsplash)
  // -------------------------

  // genera un título breve a partir de una descripción larga
  function makeShortTitle(text) {
    if (!text) return "Imagen de Unsplash";

    // 1. quitar URLs
    let t = text.replace(/https?:\/\/\S+/g, "").trim();

    // 2. cortar en el primer paréntesis / guion / barra / punto, si existe
    t = t.split(/[()\-|•·]/)[0].trim();

    // 3. si sigue muy largo, truncar a 60 caracteres
    const MAX = 60;
    if (t.length > MAX) {
      t = t.slice(0, MAX - 3).trim() + "...";
    }

    return t || "Imagen de Unsplash";
  }

  // convertir la respuesta de discover (Unsplash) a un "post" del feed
  function unsplashToPost(img) {
    const desc = img.descripcion || "Imagen de Unsplash";
    const tituloCorto = makeShortTitle(desc);

    return {
      titulo: tituloCorto,                   // título ya cortito
      fecha_alta: new Date().toISOString(),
      usuario: `${img.autor} (Unsplash)`,
      imagen: img.url_imagen,
      descripcion: desc,                     // descripción completa
      url: img.url_full,
      tags: ["unsplash"],                    // tag fija para identificar origen
      alt: desc
    };
  }

  async function cargarDiscover({ append } = { append: false }) {
    if (!$discoverContainer) return; // si no hay contenedor, no hacemos nada

    // si ya llegamos al máximo, no pegarle otra vez a la API
    if (discoverLoaded >= DISCOVER_MAX) {
      if ($msgDiscover) $msgDiscover.textContent = "Ya se cargaron todas las imágenes permitidas.";
      if ($btnDiscoverLoad) {
        $btnDiscoverLoad.disabled = true;
        $btnDiscoverLoad.textContent = "No hay más por cargar";
      }
      return;
    }

    // cuánto falta para llegar al máximo
    const remaining = DISCOVER_MAX - discoverLoaded;
    const count = Math.min(DISCOVER_CHUNK, remaining);

    try {
      if ($msgDiscover) $msgDiscover.textContent = "Cargando imágenes de Unsplash...";
      const res = await fetch(`${API}/api/discover?count=${count}`);

      if (!res.ok) {
        if ($msgDiscover) $msgDiscover.textContent = "Error al obtener imágenes de Unsplash.";
        return;
      }

      const data = await res.json();

      const tarjetasNuevas = data
        .map(unsplashToPost)   // transformamos cada imagen a "post"
        .map(card)             // usamos la misma card(post) del feed
        .join("");

      // si ya había contenido y queremos "append", agregamos al final
      if (append && $discoverContainer.innerHTML.trim() !== "") {
        const row = $discoverContainer.querySelector(".row");
        if (row) {
          row.insertAdjacentHTML("beforeend", tarjetasNuevas);
        } else {
          $discoverContainer.innerHTML = `
            <div class="row g-3">
              ${tarjetasNuevas}
            </div>
          `;
        }
      } else {
        // primera vez o queremos reemplazar todo
        $discoverContainer.innerHTML = `
          <div class="row g-3">
            ${tarjetasNuevas}
          </div>
        `;
      }

      discoverLoaded += data.length;

      if ($msgDiscover) {
        $msgDiscover.textContent = `Se han cargado ${discoverLoaded} imágenes (máx ${DISCOVER_MAX}).`;
      }

      // si ya alcanzamos el máximo, deshabilitar botón
      if (discoverLoaded >= DISCOVER_MAX && $btnDiscoverLoad) {
        $btnDiscoverLoad.disabled = true;
        $btnDiscoverLoad.textContent = "No hay más por cargar";
      }
    } catch (e) {
      console.error(e);
      if ($msgDiscover) $msgDiscover.textContent = "No se pudieron cargar las imágenes.";
    }
  }

  // botón "Cargar más" al final de la página
  if ($btnDiscoverLoad) {
    $btnDiscoverLoad.addEventListener("click", () => {
      cargarDiscover({ append: true }); // agrega más al final
    });
  }

  // botón ARRIBA "Recargar imágenes" (reinicia discover recargando la página)
  if ($btnDiscoverReload) {
    $btnDiscoverReload.addEventListener("click", () => {
      window.location.reload();
    });
  }

  // Si estamos en una página que tiene discover-contenido, cargamos el primer bloque
  if ($discoverContainer) {
    discoverLoaded = 0;
    cargarDiscover({ append: false }); // primer bloque
  }

  // -------------------------
  // Paginación (feed)
  // -------------------------
  const $prev = $("prev");
  const $next = $("next");

  if ($prev) {
    $prev.addEventListener("click", () => {
      if (paginaActual > 0) {
        paginaActual--;
        cargar(paginaActual);
      }
    });
  }

  if ($next) {
    $next.addEventListener("click", () => {
      paginaActual++;
      cargar(paginaActual);
    });
  }

  // Botón recargar (feed)
  if ($btn && $lista) {
    $btn.addEventListener("click", () => cargar(paginaActual));
  }

  // Buscar por ID
  if ($formBuscar) {
    $formBuscar.addEventListener("submit", (evt) => {
      evt.preventDefault();
      const id = $("buscar-id").value.trim();
      if (id) buscarPorId(id);
    });
  }

  // Carga inicial del feed (solo si existe el contenedor del feed)
  if ($lista) {
    cargar(paginaActual);
  }

});

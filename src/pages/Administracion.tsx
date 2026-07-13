// Administración (solo rol admin): carga masiva de colegios, valor del colegio,
// catálogos (gerencias, ejecutivos comerciales), usuarios (Supabase Auth con
// contraseña temporal), mapeo de uso y respaldos. La RLS del backend es quien
// de verdad limita cada operación. Ver docs/07-administracion-usuarios.md.
import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useAcceso } from '../lib/accesoCtx'
import {
  usoResumen, esUnicoAdminActivo, ROLES,
  agregarCatalogo, quitarCatalogo, renombrarCatalogo,
} from '../data/usuarios'
import type { Rol, Usuario, CatalogosData } from '../data/usuarios'
import {
  listarUsuarios, crearUsuario, patchUsuario, enviarRecuperacion, restaurarUsuarios,
} from '../lib/usuariosStore'
import { defaultPlaneacion, importarColegios, patchColegio, hoyISO } from '../data/planeacion'
import type { PlaneacionData } from '../data/planeacion'
import { loadLocal, loadRemote } from '../lib/planeacionStore'
import {
  initialCatalogos, loadRemoteCatalogos, saveLocalCatalogos, saveRemoteCatalogos,
} from '../lib/adminStore'
import { usePersistencia } from '../lib/persistencia'
import { usePersistenciaPlaneacion } from '../lib/persistenciaPlaneacion'
import { leerArchivo, mapearFilas } from '../lib/importColegios'
import {
  listarRespaldos, obtenerRespaldo, respaldarAhora, RETENCION_DIAS, ETIQUETA, TABLAS_RESPALDO,
} from '../lib/respaldos'
import type { RespaldoMeta } from '../lib/respaldos'
import { Seg } from '../ui/Seg'
import { NumberTicker } from '../ui/NumberTicker'
import { toast } from '../ui/toastBus'
import { SMART, CORE } from '../features/planeacion/colors'

type Tab = 'colegios' | 'catalogos' | 'usuarios' | 'uso' | 'respaldos'

const fmtFecha = (iso?: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) +
    (iso.includes('T') ? ` · ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` : '')
}

export default function Administracion() {
  const { sesion } = useAcceso()
  const [tab, setTab] = useState<Tab>('colegios')
  const [ahora] = useState(() => Date.now()) // referencia fija del render para la tabla de uso

  // ── tablero de planeación (colegios/asesores), mismo patrón que Rentabilidad ──
  const [data, setData] = useState<PlaneacionData>(() => loadLocal() ?? defaultPlaneacion())
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('Cargando…')
  useEffect(() => {
    let alive = true
    loadRemote().then((res) => {
      if (!alive) return
      if (res.source === 'remote') setData(res.data)
      setStatus(res.source === 'remote' ? 'Sincronizado' : 'Sin conexión · local')
      setReady(true)
    })
    return () => { alive = false }
  }, [])
  usePersistenciaPlaneacion(data, ready, setStatus)

  // ── catálogos (tabla psp_admin, solo gerencias/ejecutivos; escribe solo admin) ──
  const [catalogos, setCatalogos] = useState<CatalogosData>(initialCatalogos)
  const [catReady, setCatReady] = useState(false)
  useEffect(() => {
    let alive = true
    loadRemoteCatalogos().then((res) => {
      if (!alive) return
      if (res.source === 'remote') setCatalogos(res.data)
      setCatReady(true)
    })
    return () => { alive = false }
  }, [])
  usePersistencia(catalogos, catReady, saveLocalCatalogos, saveRemoteCatalogos)

  // ── usuarios (tabla psp_usuarios; la identidad vive en Supabase Auth) ──
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true)
  const refrescarUsuarios = () =>
    listarUsuarios().then((rows) => { setUsuarios(rows); setCargandoUsuarios(false) })
  useEffect(() => {
    let vivo = true
    listarUsuarios().then((rows) => { if (vivo) { setUsuarios(rows); setCargandoUsuarios(false) } })
    return () => { vivo = false }
  }, [])

  // ── Colegios: carga masiva ──
  const [importInfo, setImportInfo] = useState<{ msg: string; errores: string[] } | null>(null)
  const onArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const registros = await leerArchivo(file)
      const { filas, errores, total } = mapearFilas(registros)
      if (!filas.length) {
        setImportInfo({ msg: `No se encontraron filas válidas en «${file.name}» (${total} leídas).`, errores })
        toast('El archivo no trae filas válidas', 'err')
        return
      }
      const ok = window.confirm(
        `Se importarán ${filas.length} colegios de «${file.name}»` +
        (errores.length ? ` (${errores.length} filas con error se omiten)` : '') +
        `.\n\nEsto REEMPLAZA los cupos actuales y su avance. ¿Continuar?`)
      if (!ok) return
      const { data: nd, resumen } = importarColegios(data, filas)
      setData(nd)
      // los catálogos se alimentan del archivo (gerencias y ejecutivos nuevos)
      setCatalogos((c) => {
        let gerencias = c.gerencias, ejecutivos = c.ejecutivos
        for (const f of filas) {
          if (f.gerencia) gerencias = agregarCatalogo(gerencias, f.gerencia)
          if (f.ejecutivo) ejecutivos = agregarCatalogo(ejecutivos, f.ejecutivo)
        }
        return { gerencias, ejecutivos }
      })
      setImportInfo({
        msg: `✓ ${resumen.colegios} colegios importados (SMART ${resumen.porCampaign.SMART} · CORE ${resumen.porCampaign.CORE}) · ` +
          `${resumen.asignados} asignados a asesor · ${resumen.asesoresNuevos} asesores nuevos.`,
        errores,
      })
      toast(`${resumen.colegios} colegios importados de «${file.name}»`, errores.length ? 'err' : 'ok')
    } catch (err) {
      setImportInfo({ msg: `No se pudo leer el archivo: ${err instanceof Error ? err.message : String(err)}`, errores: [] })
      toast('No se pudo leer el archivo', 'err')
    }
  }

  // ── Colegios: valor real ──
  const [buscaCol, setBuscaCol] = useState('')
  const [capCol, setCapCol] = useState(30)
  const colegiosFiltrados = useMemo(() => {
    const q = buscaCol.trim().toLowerCase()
    return data.colegios.filter((c) => !q || c.nombre.toLowerCase().includes(q) || (c.gerencia ?? '').toLowerCase().includes(q))
  }, [data.colegios, buscaCol])
  const patchCol = (id: string, patch: Parameters<typeof patchColegio>[2]) =>
    setData((d) => ({ ...d, colegios: patchColegio(d.colegios, id, patch) }))

  // ── Catálogos ──
  const [nuevaGer, setNuevaGer] = useState('')
  const [nuevoEje, setNuevoEje] = useState('')
  const [editCat, setEditCat] = useState<{ tipo: 'gerencias' | 'ejecutivos'; valor: string; texto: string } | null>(null)
  const renombrarConPropagacion = (tipo: 'gerencias' | 'ejecutivos', viejo: string, nuevo: string) => {
    if (!nuevo.trim() || nuevo === viejo) return
    setCatalogos((c) => ({ ...c, [tipo]: renombrarCatalogo(c[tipo], viejo, nuevo) }))
    // propaga a los colegios que lo referencian
    const campo = tipo === 'gerencias' ? 'gerencia' : 'ejecutivo'
    setData((d) => ({ ...d, colegios: d.colegios.map((c) => c[campo] === viejo ? { ...c, [campo]: nuevo.trim() } : c) }))
    toast(`Renombrado en el catálogo y en los colegios`, 'ok')
  }

  const catalogoPanel = (tipo: 'gerencias' | 'ejecutivos', titulo: string, nuevoVal: string, setNuevoVal: (s: string) => void) => {
    const lista = catalogos[tipo]
    const campo = tipo === 'gerencias' ? 'gerencia' : 'ejecutivo'
    const usados = new Map<string, number>()
    for (const c of data.colegios) { const v = c[campo]; if (v) usados.set(v, (usados.get(v) ?? 0) + 1) }
    return (
      <div className="panel" style={{ flex: '1 1 320px' }}>
        <h3>{titulo}</h3>
        <form style={{ display: 'flex', gap: 6, marginBottom: 10 }} onSubmit={(e) => {
          e.preventDefault()
          if (!nuevoVal.trim()) return
          setCatalogos((c) => ({ ...c, [tipo]: agregarCatalogo(c[tipo], nuevoVal) }))
          setNuevoVal('')
        }}>
          <input value={nuevoVal} onChange={(e) => setNuevoVal(e.target.value)} placeholder={`Agregar ${titulo.toLowerCase().replace(/s$/, '')}…`}
            style={{ flex: 1, fontSize: 12.5, padding: '6px 9px' }} />
          <button className="sec" type="submit" disabled={!nuevoVal.trim()}>Agregar</button>
        </form>
        {lista.length === 0 && <div className="hint">Vacío. Se llena aquí o automáticamente con la carga masiva.</div>}
        {lista.map((v) => (
          <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
            {editCat && editCat.tipo === tipo && editCat.valor === v ? (
              <input value={editCat.texto} autoFocus onChange={(e) => setEditCat({ ...editCat, texto: e.target.value })}
                onBlur={() => { renombrarConPropagacion(tipo, v, editCat.texto); setEditCat(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { renombrarConPropagacion(tipo, v, editCat.texto); setEditCat(null) } if (e.key === 'Escape') setEditCat(null) }}
                style={{ flex: 1, fontSize: 12.5, padding: '4px 7px' }} />
            ) : (
              <span style={{ flex: 1, fontSize: 13 }}>{v}
                <span style={{ color: 'var(--faint)', fontSize: 11 }}> · {usados.get(v) ?? 0} colegios</span>
              </span>
            )}
            <button title="Renombrar" aria-label={`Renombrar ${v}`} onClick={() => setEditCat({ tipo, valor: v, texto: v })}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--mut)' }}>✎</button>
            <button title="Quitar del catálogo" aria-label={`Quitar ${v}`}
              onClick={() => { if (window.confirm(`¿Quitar «${v}» del catálogo? Los colegios que lo usan conservan el dato.`)) setCatalogos((c) => ({ ...c, [tipo]: quitarCatalogo(c[tipo], v) })) }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, color: 'var(--mut)' }}>×</button>
          </div>
        ))}
      </div>
    )
  }

  // ── Usuarios ──
  const [uNombre, setUNombre] = useState('')
  const [uApellido, setUApellido] = useState('')
  const [uCorreo, setUCorreo] = useState('')
  const [uFecha, setUFecha] = useState(hoyISO())
  const [uRol, setURol] = useState<Rol>('asesor')
  const [uAsesor, setUAsesor] = useState('nueva')  // 'nueva' | id de asesor existente
  const [uEjecutivo, setUEjecutivo] = useState('') // rol ejecutivo: nombre como en «Ejecutivo Responsable»
  const [creando, setCreando] = useState(false)
  const [tempCreada, setTempCreada] = useState<{ nombre: string; correo: string; pass: string } | null>(null)

  const asesoresLibres = useMemo(() => {
    const ligados = new Set(usuarios.map((u) => u.asesorId).filter(Boolean))
    return data.asesores.filter((a) => !ligados.has(a.id))
  }, [usuarios, data.asesores])

  const crear = async (e: FormEvent) => {
    e.preventDefault()
    setCreando(true)
    const asesorExistente = uRol === 'asesor' && uAsesor !== 'nueva' ? uAsesor : undefined
    const r = await crearUsuario({
      nombre: uNombre, apellido: uApellido, correo: uCorreo, fechaIngreso: uFecha, rol: uRol,
      asesorId: asesorExistente,
      ejecutivo: uRol === 'ejecutivo' ? uEjecutivo.trim() || undefined : undefined,
    })
    if (!r.ok) { toast(r.error, 'err'); setCreando(false); return }
    let creado = r.usuario
    // rol asesor sin hoja existente → crea su hoja en planeación y la liga al perfil
    if (uRol === 'asesor' && !asesorExistente) {
      const nuevoAse = { id: `ase-u-${creado.id.slice(0, 8)}`, nombre: `${creado.nombre} ${creado.apellido}`.trim() }
      setData((d) => ({ ...d, asesores: [...d.asesores, nuevoAse] }))
      await patchUsuario(creado.id, { asesorId: nuevoAse.id })
      creado = { ...creado, asesorId: nuevoAse.id }
    }
    setUsuarios((us) => [...us, creado])
    setTempCreada({ nombre: `${creado.nombre} ${creado.apellido}`, correo: creado.correo, pass: r.tempPassword })
    setUNombre(''); setUApellido(''); setUCorreo(''); setUAsesor('nueva'); setUEjecutivo(''); setCreando(false)
    toast(`Usuario creado: ${creado.correo}`, 'ok')
  }

  const reset = async (u: Usuario) => {
    if (!window.confirm(`Se enviará un correo de recuperación a ${u.correo} para que ponga contraseña nueva. ¿Continuar?`)) return
    const r = await enviarRecuperacion(u.correo)
    toast(r.ok ? `Correo de recuperación enviado a ${u.correo}` : `No se pudo enviar: ${r.error}`, r.ok ? 'ok' : 'err')
  }

  // Guardas anti-lockout (la RLS y el trigger del backend también las imponen).
  const aplicarPatch = async (u: Usuario, patch: Partial<Usuario>) => {
    const r = await patchUsuario(u.id, patch)
    if (!r.ok) { toast(`No se pudo guardar: ${r.error}`, 'err'); return }
    setUsuarios((us) => us.map((x) => (x.id === u.id ? { ...x, ...patch } : x)))
  }
  const cambiarRol = (u: Usuario, nuevoRol: Rol) => {
    if (nuevoRol === u.rol) return
    if (nuevoRol !== 'admin' && esUnicoAdminActivo(usuarios, u.id)) {
      toast('No puedes quitar el rol al único administrador activo.', 'err'); return
    }
    if (u.id === sesion.usuarioId && nuevoRol !== 'admin') {
      toast('No puedes cambiar tu propio rol de administrador.', 'err'); return
    }
    void aplicarPatch(u, { rol: nuevoRol })
  }
  const alternarActivo = (u: Usuario) => {
    if (u.activo && u.id === sesion.usuarioId) {
      toast('No puedes desactivar tu propia cuenta.', 'err'); return
    }
    if (u.activo && esUnicoAdminActivo(usuarios, u.id)) {
      toast('No puedes desactivar al único administrador activo.', 'err'); return
    }
    void aplicarPatch(u, { activo: !u.activo })
  }

  const nombreAsesor = (id?: string) => id ? (data.asesores.find((a) => a.id === id)?.nombre ?? id) : '—'

  // ── Uso ──
  const uso = usoResumen(usuarios)
  const usuariosPorUso = useMemo(() =>
    [...usuarios].sort((a, b) => (b.ultimoIngreso ?? '').localeCompare(a.ultimoIngreso ?? '')), [usuarios])

  // ── Respaldos ──
  const [respaldos, setRespaldos] = useState<RespaldoMeta[]>([])
  const [cargandoResp, setCargandoResp] = useState(true)
  const [ocupadoResp, setOcupadoResp] = useState(false)
  const cargarRespaldos = () => {
    setCargandoResp(true)
    listarRespaldos().then((r) => { setRespaldos(r); setCargandoResp(false) })
  }
  useEffect(() => {
    if (tab !== 'respaldos') return
    let vivo = true
    listarRespaldos().then((r) => { if (vivo) { setRespaldos(r); setCargandoResp(false) } })
    return () => { vivo = false }
  }, [tab])

  const respaldarTodoAhora = async () => {
    setOcupadoResp(true)
    const okP = await respaldarAhora('planeacion', data)
    const okU = await respaldarAhora('usuarios', usuarios)
    const okC = await respaldarAhora('catalogos', catalogos)
    setOcupadoResp(false)
    const ok = okP && okU && okC
    toast(ok ? 'Respaldo del día creado' : 'No se pudo respaldar (¿permisos o tabla psp_respaldos?)', ok ? 'ok' : 'err')
    cargarRespaldos()
  }

  const restaurar = async (m: RespaldoMeta) => {
    if (!window.confirm(
      `Restaurar «${ETIQUETA[m.tabla]}» al respaldo del ${m.fecha}.\n\n` +
      `Esto REEMPLAZA los datos actuales de ${ETIQUETA[m.tabla]}.` +
      (m.tabla === 'usuarios' ? '\n(Las contraseñas NO cambian: viven en Auth y no forman parte del respaldo.)' : '') +
      `\n\n¿Continuar?`)) return
    setOcupadoResp(true)
    const contenido = await obtenerRespaldo(m.id)
    if (!contenido) { setOcupadoResp(false); toast('No se pudo leer el respaldo', 'err'); return }
    if (m.tabla === 'usuarios') {
      const rows = contenido as Usuario[]
      if (!rows.some((u) => u.rol === 'admin' && u.activo)) {
        setOcupadoResp(false)
        toast('Ese respaldo no tiene un administrador activo; no se restaura para evitar un lockout.', 'err'); return
      }
      const r = await restaurarUsuarios(rows)
      if (!r.ok) { setOcupadoResp(false); toast(`No se pudo restaurar: ${r.error}`, 'err'); return }
      await refrescarUsuarios()
    } else if (m.tabla === 'catalogos') {
      setCatalogos(contenido as CatalogosData)
    } else {
      setData(contenido as PlaneacionData)
    }
    setOcupadoResp(false)
    toast(`Restaurado «${ETIQUETA[m.tabla]}» del ${m.fecha}`, 'ok')
  }

  const respaldosPorTabla = (t: RespaldoMeta['tabla']) => respaldos.filter((r) => r.tabla === t)

  return (
    <div>
      <h1>Administración</h1>
      <div className="sub">Catálogo de colegios, gerencias y ejecutivos comerciales, cuentas de usuario, uso y respaldos.
        <b> · Colegios: {status}</b></div>

      <Seg maxWidth={680} value={tab} onChange={setTab} options={[
        { key: 'colegios', label: 'Colegios' },
        { key: 'catalogos', label: 'Catálogos' },
        { key: 'usuarios', label: 'Usuarios' },
        { key: 'uso', label: 'Uso' },
        { key: 'respaldos', label: 'Respaldos' },
      ]} />

      {tab === 'colegios' && (<>
        <div className="panel">
          <h3>Carga masiva · archivo de BI</h3>
          <p style={{ fontSize: 12, color: 'var(--mut)', margin: '4px 0 10px', lineHeight: 1.5 }}>
            Importa el catálogo real (Excel o CSV con la plantilla oficial). Reemplaza los cupos actuales;
            el «Asesor Pedagógico» se vuelve asesor y recibe sus colegios; gerencias y ejecutivos del archivo
            alimentan los catálogos en automático.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <a className="sec" href={`${import.meta.env.BASE_URL}plantilla-colegios.xlsx`} download="plantilla-colegios.xlsx"
              style={{ textDecoration: 'none', display: 'inline-block' }}>📥 Descargar plantilla (.xlsx)</a>
            <label className="sec" style={{ cursor: 'pointer', display: 'inline-block' }}>
              📤 Importar archivo…
              <input type="file" accept=".csv,.xlsx,.xls" onChange={onArchivo} style={{ display: 'none' }} />
            </label>
          </div>
          {importInfo && (
            <div className="hint" style={{ marginTop: 10 }}>
              {importInfo.msg}
              {importInfo.errores.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {importInfo.errores.slice(0, 6).map((er, i) => <li key={i}>{er}</li>)}
                  {importInfo.errores.length > 6 && <li>… y {importInfo.errores.length - 6} más.</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="panel">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, flex: 1 }}>Valor del colegio</h3>
            <input value={buscaCol} onChange={(e) => { setBuscaCol(e.target.value); setCapCol(30) }} placeholder="🔍 Colegio o gerencia…"
              aria-label="Buscar colegio" style={{ width: 200, fontSize: 12, padding: '5px 8px' }} />
            <span style={{ fontSize: 12, color: 'var(--mut)' }}>{colegiosFiltrados.length.toLocaleString('es-MX')} colegios</span>
          </div>
          <table>
            <thead><tr><th>Colegio</th><th>Gerencia</th><th>Ejecutivo comercial</th><th>Valor real (MXN)</th></tr></thead>
            <tbody>
              {colegiosFiltrados.slice(0, capCol).map((c) => (
                <tr key={c.id}>
                  <td><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 7, marginRight: 5, background: c.campaign === 'SMART' ? SMART : CORE }} />{c.nombre}</td>
                  <td>
                    <select value={c.gerencia ?? ''} aria-label="Gerencia" onChange={(e) => patchCol(c.id, { gerencia: e.target.value || undefined })}
                      style={{ fontSize: 11.5, width: 'auto', minWidth: 110 }}>
                      <option value="">—</option>
                      {catalogos.gerencias.map((gr) => <option key={gr} value={gr}>{gr}</option>)}
                      {c.gerencia && !catalogos.gerencias.includes(c.gerencia) && <option value={c.gerencia}>{c.gerencia}</option>}
                    </select>
                  </td>
                  <td>
                    <select value={c.ejecutivo ?? ''} aria-label="Ejecutivo comercial" onChange={(e) => patchCol(c.id, { ejecutivo: e.target.value || undefined })}
                      style={{ fontSize: 11.5, width: 'auto', minWidth: 110 }}>
                      <option value="">—</option>
                      {catalogos.ejecutivos.map((ej) => <option key={ej} value={ej}>{ej}</option>)}
                      {c.ejecutivo && !catalogos.ejecutivos.includes(c.ejecutivo) && <option value={c.ejecutivo}>{c.ejecutivo}</option>}
                    </select>
                  </td>
                  <td>
                    <input type="number" min={0} step={1000} value={c.valorReal ?? ''} placeholder="0" aria-label="Valor real"
                      onChange={(e) => patchCol(c.id, { valorReal: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
                      style={{ width: 110, fontSize: 11.5, padding: '3px 6px' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {colegiosFiltrados.length > capCol && (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button className="sec" onClick={() => setCapCol((c) => c + 30)}>Mostrar 30 más ({(colegiosFiltrados.length - capCol).toLocaleString('es-MX')} restantes)</button>
            </div>
          )}
          <div className="hint">El «Valor real» alimenta el módulo de Retorno. Gerencia y ejecutivo salen de los catálogos.</div>
        </div>
      </>)}

      {tab === 'catalogos' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {catalogoPanel('gerencias', 'Gerencias', nuevaGer, setNuevaGer)}
          {catalogoPanel('ejecutivos', 'Ejecutivos comerciales', nuevoEje, setNuevoEje)}
        </div>
      )}

      {tab === 'usuarios' && (<>
        {tempCreada && (
          <div className="panel" style={{ background: 'var(--gold-wash)', borderColor: 'var(--gold-l)' }}>
            <h3 style={{ color: '#8A6D1C' }}>Contraseña temporal generada</h3>
            <p style={{ fontSize: 13, margin: '0 0 8px', lineHeight: 1.6 }}>
              Comparte estos datos con <b>{tempCreada.nombre}</b> por un canal seguro. La contraseña se muestra
              <b> solo esta vez</b>; al entrar se le pedirá cambiarla.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 14 }}>
              <span>Correo: <b>{tempCreada.correo}</b></span>
              <span>Contraseña temporal: <b style={{ fontFamily: 'monospace', fontSize: 16, letterSpacing: 1 }}>{tempCreada.pass}</b></span>
              <button className="sec" onClick={() => { navigator.clipboard?.writeText(`${tempCreada.correo} · ${tempCreada.pass}`); toast('Copiado al portapapeles', 'ok') }}>Copiar</button>
              <button className="sec" onClick={() => setTempCreada(null)}>Cerrar</button>
            </div>
          </div>
        )}

        <div className="panel">
          <h3>Crear usuario</h3>
          <form onSubmit={crear} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ flex: '1 1 140px', margin: 0 }}>Nombre
              <input value={uNombre} onChange={(e) => setUNombre(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '6px 8px', marginTop: 3 }} /></label>
            <label style={{ flex: '1 1 140px', margin: 0 }}>Apellido
              <input value={uApellido} onChange={(e) => setUApellido(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '6px 8px', marginTop: 3 }} /></label>
            <label style={{ flex: '1 1 200px', margin: 0 }}>Correo electrónico
              <input type="email" value={uCorreo} onChange={(e) => setUCorreo(e.target.value)} placeholder="nombre@grupo-sm.com" style={{ width: '100%', fontSize: 13, padding: '6px 8px', marginTop: 3 }} /></label>
            <label style={{ flex: '0 1 150px', margin: 0 }}>Fecha de ingreso
              <input type="date" value={uFecha} onChange={(e) => setUFecha(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '6px 8px', marginTop: 3 }} /></label>
            <label style={{ flex: '0 1 190px', margin: 0 }}>Rol
              <select value={uRol} onChange={(e) => setURol(e.target.value as Rol)} style={{ width: '100%', fontSize: 13, padding: '6px 8px', marginTop: 3 }}>
                {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select></label>
            {uRol === 'asesor' && (
              <label style={{ flex: '0 1 210px', margin: 0 }}>Hoja de asesor
                <select value={uAsesor} onChange={(e) => setUAsesor(e.target.value)} style={{ width: '100%', fontSize: 13, padding: '6px 8px', marginTop: 3 }}>
                  <option value="nueva">Crear hoja nueva</option>
                  {asesoresLibres.map((a) => <option key={a.id} value={a.id}>Ligar a: {a.nombre}</option>)}
                </select></label>
            )}
            {uRol === 'ejecutivo' && (
              <label style={{ flex: '0 1 230px', margin: 0 }}>Nombre en «Ejecutivo Responsable»
                <input value={uEjecutivo} onChange={(e) => setUEjecutivo(e.target.value)} list="dl-ejecutivos"
                  placeholder="Tal como viene del BI" style={{ width: '100%', fontSize: 13, padding: '6px 8px', marginTop: 3 }} />
                <datalist id="dl-ejecutivos">
                  {catalogos.ejecutivos.map((ej) => <option key={ej} value={ej} />)}
                </datalist></label>
            )}
            <button className="gate-btn" type="submit" style={{ width: 'auto', padding: '9px 18px' }}
              disabled={creando || !uNombre.trim() || !uApellido.trim() || !uCorreo.trim() || (uRol === 'ejecutivo' && !uEjecutivo.trim())}>{creando ? 'Creando…' : 'Crear con contraseña temporal'}</button>
          </form>
          <div className="hint">La cuenta se crea en Supabase Auth con una contraseña temporal (se muestra una sola vez) y la persona debe cambiarla en su primer ingreso.</div>
        </div>

        <div className="panel">
          <h3>Usuarios ({usuarios.length})</h3>
          {cargandoUsuarios ? <div className="hint">Cargando…</div> : (
          <table>
            <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Ingreso a SM</th><th>Vínculo</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.5 }}>
                  <td>{u.nombre} {u.apellido}{u.tempPassword && <span title="Aún no cambia su contraseña temporal" style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, color: '#8A6D1C', background: 'var(--gold-wash)', padding: '1px 5px', borderRadius: 6 }}>TEMP</span>}</td>
                  <td style={{ color: 'var(--mut)' }}>{u.correo}</td>
                  <td>
                    <select value={u.rol} aria-label="Rol" onChange={(e) => cambiarRol(u, e.target.value as Rol)}
                      style={{ fontSize: 11.5, width: 'auto' }}>
                      {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                    </select>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(u.fechaIngreso)}</td>
                  <td style={{ color: 'var(--mut)' }}>{u.rol === 'asesor' ? nombreAsesor(u.asesorId) : u.rol === 'ejecutivo' ? (u.ejecutivo ?? '⚠ sin nombre de BI') : '—'}</td>
                  <td>
                    <button className="sec" style={{ fontSize: 11 }} onClick={() => alternarActivo(u)}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="sec" style={{ fontSize: 11 }} onClick={() => reset(u)}>Enviar recuperación</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          <div className="hint">«Inactivo» bloquea el acceso sin borrar el historial (la RLS del backend lo impone).
            «Enviar recuperación» manda un correo con enlace para poner contraseña nueva.</div>
        </div>
      </>)}

      {tab === 'uso' && (<>
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          <div className="kpi"><div className="v"><NumberTicker value={uso.total} /></div><div className="l">Cuentas</div></div>
          <div className="kpi good"><div className="v"><NumberTicker value={uso.activos7d} /></div><div className="l">Entraron esta semana</div></div>
          <div className="kpi warn"><div className="v"><NumberTicker value={uso.nuncaEntraron} /></div><div className="l">Nunca han entrado</div></div>
          <div className="kpi"><div className="v"><NumberTicker value={uso.ingresosTotales} /></div><div className="l">Ingresos acumulados</div></div>
        </div>
        <div className="panel">
          <h3>Mapeo de uso por persona</h3>
          <table>
            <thead><tr><th>Usuario</th><th>Rol</th><th>Último ingreso</th><th># Ingresos</th><th>Señal</th></tr></thead>
            <tbody>
              {usuariosPorUso.map((u) => {
                const dias = u.ultimoIngreso ? Math.floor((ahora - new Date(u.ultimoIngreso).getTime()) / 86400000) : null
                const senal = !u.activo ? { t: 'Desactivado', c: 'var(--faint)' }
                  : dias === null ? { t: 'Nunca ha entrado', c: 'var(--gold)' }
                  : dias <= 7 ? { t: 'Activo', c: 'var(--core)' }
                  : { t: `${dias} días sin entrar`, c: 'var(--gold)' }
                return (
                  <tr key={u.id}>
                    <td>{u.nombre} {u.apellido}</td>
                    <td style={{ color: 'var(--mut)' }}>{ROLES.find((r) => r.key === u.rol)?.label}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtFecha(u.ultimoIngreso)}</td>
                    <td>{u.ingresos}</td>
                    <td style={{ color: senal.c, fontWeight: 600 }}>{senal.t}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="hint">La señal marca a quién dar seguimiento: cuentas sin primer ingreso o sin actividad reciente.</div>
        </div>
      </>)}

      {tab === 'respaldos' && (<>
        <div className="panel">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, flex: 1 }}>Respaldos diarios</h3>
            <button className="sec" onClick={cargarRespaldos} disabled={cargandoResp || ocupadoResp}>↻ Actualizar</button>
            <button className="gate-btn" style={{ width: 'auto', padding: '8px 16px' }} onClick={respaldarTodoAhora} disabled={ocupadoResp}>
              {ocupadoResp ? 'Trabajando…' : '💾 Respaldar ahora'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--mut)', margin: '6px 0 0', lineHeight: 1.5 }}>
            Cada día, en el primer acceso de un administrador, se guarda una copia de <b>Planeación</b>,
            <b> Usuarios</b> y <b>Catálogos</b>. Se conservan los últimos <b>{RETENCION_DIAS} días</b> y solo
            los administradores pueden verlos o restaurarlos. Restaurar reemplaza los datos actuales de esa
            sección con los de la fecha elegida (las contraseñas nunca forman parte del respaldo).
          </p>
        </div>

        {TABLAS_RESPALDO.map((t) => {
          const lista = respaldosPorTabla(t)
          return (
            <div className="panel" key={t}>
              <h3>{ETIQUETA[t]} · {lista.length} respaldo{lista.length === 1 ? '' : 's'}</h3>
              {cargandoResp ? <div className="hint">Cargando…</div>
                : lista.length === 0 ? <div className="hint">Aún no hay respaldos. Se creará uno en el próximo acceso, o pulsa «Respaldar ahora».</div>
                : (
                  <table>
                    <thead><tr><th>Fecha</th><th>Creado</th><th></th></tr></thead>
                    <tbody>
                      {lista.map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600 }}>{m.fecha}</td>
                          <td style={{ color: 'var(--mut)' }}>{fmtFecha(m.created_at)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="sec" style={{ fontSize: 11 }} disabled={ocupadoResp} onClick={() => restaurar(m)}>Restaurar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
          )
        })}
      </>)}
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { ReactNode, FormEvent } from 'react'
import logoSM from './assets/logo-sm.svg'
import { initialAdmin, saveLocalAdmin, loadRemoteAdmin, saveRemoteAdmin } from './lib/adminStore'
import { autenticar, cambiarPassword, registrarIngreso } from './data/usuarios'
import { leerSesion, guardarSesion, cerrarSesion } from './lib/sesion'
import type { Sesion } from './lib/sesion'
import { AccesoContexto } from './lib/accesoCtx'

// ─── Acceso (V3): login por usuario + roles ───────────────────────────────────
// Reemplaza al gate de contraseña compartida. Cada usuario entra con su correo;
// las cuentas y roles se administran en la pestaña Administración. Si su
// contraseña es temporal, se le obliga a cambiarla antes de continuar.
// NOTA: autenticación del lado del cliente (maqueta) hasta conectar el Supabase
// nuevo con Auth+RLS; el flujo de la app ya es el definitivo.

export default function Acceso({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState(initialAdmin)
  const [ready, setReady] = useState(false)
  const [adminStatus, setAdminStatus] = useState('Cargando…')
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion)
  // login
  const [correo, setCorreo] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // cambio de contraseña obligatorio
  const [nueva, setNueva] = useState('')
  const [confirma, setConfirma] = useState('')

  // carga remota inicial (lo remoto gana); si no hay conexión, local/semilla
  useEffect(() => {
    let alive = true
    loadRemoteAdmin().then((res) => {
      if (!alive) return
      if (res.source === 'remote') setAdmin(res.data)
      setAdminStatus(res.source === 'remote' ? 'Sincronizado' : 'Sin conexión · local')
      setReady(true)
    })
    return () => { alive = false }
  }, [])

  // guardado: local inmediato + remoto con debounce
  useEffect(() => {
    if (!ready) return
    saveLocalAdmin(admin)
    const t = window.setTimeout(() => {
      setAdminStatus('Guardando…')
      saveRemoteAdmin(admin).then((r) => setAdminStatus(r.ok ? 'Sincronizado' : 'Sin conexión · local'))
    }, 700)
    return () => clearTimeout(t)
  }, [admin, ready])

  const usuario = sesion ? admin.usuarios.find((u) => u.id === sesion.usuarioId) : null
  const salir = () => { cerrarSesion(); setSesion(null); setPw(''); setErr('') }

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const u = await autenticar(admin, correo, pw)
    if (!u) { setErr('Correo o contraseña incorrectos.'); setBusy(false); setPw(''); return }
    setAdmin((d) => registrarIngreso(d, u.id))
    const s: Sesion = { usuarioId: u.id, rol: u.rol, nombre: `${u.nombre} ${u.apellido}`.trim(), asesorId: u.asesorId }
    guardarSesion(s); setSesion(s); setBusy(false); setPw('')
  }

  const guardarNueva = async (e: FormEvent) => {
    e.preventDefault()
    if (nueva.length < 8) { setErr('La contraseña debe tener al menos 8 caracteres.'); return }
    if (nueva !== confirma) { setErr('Las contraseñas no coinciden.'); return }
    setBusy(true); setErr('')
    const d = await cambiarPassword(admin, usuario!.id, nueva)
    setAdmin(d); setNueva(''); setConfirma(''); setBusy(false)
  }

  // sesión huérfana (usuario borrado o desactivado) → volver al login
  if (sesion && (!usuario || !usuario.activo)) { salir(); return null }

  if (!sesion) {
    return (
      <div className="gate">
        <form className="gate-card" onSubmit={entrar}>
          <img src={logoSM} alt="SM México" className="gate-logo" />
          <h1 className="gate-title">Servicios Pedagógicos</h1>
          <p className="gate-sub">Planeación 2026-2027 · SM México. Entra con tu cuenta.</p>
          <input type="email" value={correo} autoFocus placeholder="correo@sm.com.mx" autoComplete="username"
            className="gate-input" onChange={(e) => { setCorreo(e.target.value); setErr('') }} />
          <input type="password" value={pw} placeholder="Contraseña" autoComplete="current-password"
            className={`gate-input ${err ? 'err' : ''}`} onChange={(e) => { setPw(e.target.value); setErr('') }} />
          {err && <div className="gate-err">{err}</div>}
          <button className="gate-btn" type="submit" disabled={busy || !correo || !pw}>{busy ? 'Verificando…' : 'Entrar'}</button>
          <p className="hint" style={{ marginTop: 14 }}>¿Sin cuenta o contraseña olvidada? Pide al administrador que te la genere.</p>
        </form>
      </div>
    )
  }

  if (usuario!.tempPassword) {
    return (
      <div className="gate">
        <form className="gate-card" onSubmit={guardarNueva}>
          <img src={logoSM} alt="SM México" className="gate-logo" />
          <h1 className="gate-title">Crea tu contraseña</h1>
          <p className="gate-sub">Hola, {usuario!.nombre}. Tu contraseña actual es temporal:
            elige una definitiva para continuar (mínimo 8 caracteres).</p>
          <input type="password" value={nueva} autoFocus placeholder="Nueva contraseña" autoComplete="new-password"
            className="gate-input" onChange={(e) => { setNueva(e.target.value); setErr('') }} />
          <input type="password" value={confirma} placeholder="Repítela" autoComplete="new-password"
            className={`gate-input ${err ? 'err' : ''}`} onChange={(e) => { setConfirma(e.target.value); setErr('') }} />
          {err && <div className="gate-err">{err}</div>}
          <button className="gate-btn" type="submit" disabled={busy || !nueva || !confirma}>{busy ? 'Guardando…' : 'Guardar y entrar'}</button>
          <button type="button" className="sec" style={{ width: '100%', marginTop: 10 }} onClick={salir}>Salir</button>
        </form>
      </div>
    )
  }

  return (
    <AccesoContexto.Provider value={{ sesion, admin, setAdmin, adminStatus, salir }}>
      {children}
    </AccesoContexto.Provider>
  )
}

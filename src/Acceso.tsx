import { useEffect, useState } from 'react'
import type { ReactNode, FormEvent } from 'react'
import logoSM from './assets/logo-sm.svg'
import { supabase } from './lib/supabase'
import { miPerfil, registrarIngreso, marcarPasswordCambiada, listarUsuarios } from './lib/usuariosStore'
import { respaldadoHoy, respaldarSiNuevoDia } from './lib/respaldos'
import { resetLocalData } from './lib/localData'
import type { Usuario } from './data/usuarios'
import type { Sesion } from './lib/sesion'
import { AccesoContexto } from './lib/accesoCtx'

// ─── Acceso (V3 · blindada): Supabase Auth + perfil con rol ───────────────────
// La identidad (correo/contraseña, bcrypt, tokens) la maneja Supabase Auth; el
// perfil (rol, hoja de asesor, activo) vive en psp_usuarios detrás de RLS.
// Una cuenta sin fila de perfil o desactivada NO entra aunque autentique.
// El flag temp_password fuerza el cambio de contraseña en el primer ingreso, y
// los enlaces de recuperación (PASSWORD_RECOVERY) caen en la misma pantalla.

type Fase = 'cargando' | 'login' | 'cambiar' | 'dentro'

export default function Acceso({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>('cargando')
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  // login
  const [correo, setCorreo] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // cambio de contraseña (obligatorio o por recuperación)
  const [nueva, setNueva] = useState('')
  const [confirma, setConfirma] = useState('')

  // Valida el perfil de la sesión actual; expulsa cuentas sin perfil o inactivas.
  const cargarPerfil = async (registrar: boolean): Promise<void> => {
    const p = await miPerfil()
    if (!p) {
      await supabase.auth.signOut()
      setUsuario(null); setFase('login')
      setErr('Tu cuenta no está autorizada en esta aplicación. Pide al administrador que la dé de alta.')
      return
    }
    if (!p.activo) {
      await supabase.auth.signOut()
      setUsuario(null); setFase('login')
      setErr('Tu cuenta está desactivada. Contacta al administrador.')
      return
    }
    if (registrar) void registrarIngreso(p)
    // respaldo diario de perfiles: solo lo logra un admin (RLS); una vez al día
    if (p.rol === 'admin' && !respaldadoHoy('usuarios')) {
      void listarUsuarios().then((rows) => { if (rows.length) void respaldarSiNuevoDia('usuarios', rows) })
    }
    setUsuario(p)
    setFase(p.tempPassword ? 'cambiar' : 'dentro')
  }

  // Arranque: ¿hay sesión guardada? + eventos de Auth (recovery, signout, expiración)
  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      if (data.session) void cargarPerfil(false)
      else setFase('login')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (!vivo) return
      if (evento === 'PASSWORD_RECOVERY') {
        // llegó por enlace de recuperación: sesión temporal → debe poner contraseña nueva
        setFase('cambiar')
        void miPerfil().then((p) => { if (vivo && p) setUsuario(p) })
      }
      if (evento === 'SIGNED_OUT') { setUsuario(null); setFase('login') }
    })
    return () => { vivo = false; sub.subscription.unsubscribe() }
     
  }, [])

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password: pw })
    if (error) {
      setErr(/invalid/i.test(error.message) ? 'Correo o contraseña incorrectos.' : `No se pudo entrar: ${error.message}`)
      setBusy(false); setPw(''); return
    }
    await cargarPerfil(true)
    setBusy(false); setPw('')
  }

  const guardarNueva = async (e: FormEvent) => {
    e.preventDefault()
    if (nueva.length < 8) { setErr('La contraseña debe tener al menos 8 caracteres.'); return }
    if (nueva !== confirma) { setErr('Las contraseñas no coinciden.'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.auth.updateUser({ password: nueva })
    if (error) { setErr(`No se pudo guardar: ${error.message}`); setBusy(false); return }
    if (usuario) {
      await marcarPasswordCambiada(usuario.id)
      setUsuario({ ...usuario, tempPassword: false })
      setFase('dentro')
    } else {
      // venía de un enlace de recuperación sin perfil cargado aún
      await cargarPerfil(true)
    }
    setNueva(''); setConfirma(''); setBusy(false)
  }

  const salir = () => {
    void supabase.auth.signOut()
    resetLocalData()   // limpia espejos locales (planeación/catálogos): nada queda en equipos compartidos
    setUsuario(null); setPw(''); setErr(''); setFase('login')
  }

  if (fase === 'cargando') {
    return <div className="gate"><div className="gate-card"><img src={logoSM} alt="SM México" className="gate-logo" /><p className="gate-sub">Verificando sesión…</p></div></div>
  }

  if (fase === 'login') {
    return (
      <div className="gate">
        <form className="gate-card" onSubmit={entrar}>
          <img src={logoSM} alt="SM México" className="gate-logo" />
          <h1 className="gate-title">Servicios Pedagógicos</h1>
          <p className="gate-sub">Planeación 2026-2027 · SM México. Entra con tu cuenta.</p>
          <input type="email" value={correo} autoFocus placeholder="correo@grupo-sm.com" autoComplete="username"
            className="gate-input" onChange={(e) => { setCorreo(e.target.value); setErr('') }} />
          <input type="password" value={pw} placeholder="Contraseña" autoComplete="current-password"
            className={`gate-input ${err ? 'err' : ''}`} onChange={(e) => { setPw(e.target.value); setErr('') }} />
          {err && <div className="gate-err">{err}</div>}
          <button className="gate-btn" type="submit" disabled={busy || !correo || !pw}>{busy ? 'Verificando…' : 'Entrar'}</button>
          <p className="hint" style={{ marginTop: 14 }}>¿Sin cuenta o contraseña olvidada? Pide al administrador que te dé de alta o te envíe la recuperación.</p>
        </form>
      </div>
    )
  }

  if (fase === 'cambiar') {
    return (
      <div className="gate">
        <form className="gate-card" onSubmit={guardarNueva}>
          <img src={logoSM} alt="SM México" className="gate-logo" />
          <h1 className="gate-title">Crea tu contraseña</h1>
          <p className="gate-sub">{usuario ? `Hola, ${usuario.nombre}. ` : ''}Elige una contraseña definitiva
            para continuar (mínimo 8 caracteres). No reutilices contraseñas de otros servicios.</p>
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

  const sesion: Sesion = {
    usuarioId: usuario!.id,
    rol: usuario!.rol,
    nombre: `${usuario!.nombre} ${usuario!.apellido}`.trim(),
    asesorId: usuario!.asesorId,
    ejecutivo: usuario!.ejecutivo,
  }

  return (
    <AccesoContexto.Provider value={{ sesion, salir }}>
      {children}
    </AccesoContexto.Provider>
  )
}

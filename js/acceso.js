import { supabase } from './supabase-config.js';

export async function verificarAcceso() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { estado: 'sin-sesion', email: null };

  const email = session.user.email;
  const { data, error } = await supabase
    .from('suscriptores')
    .select('estado')
    .eq('email', email)
    .single();

  if (error || !data) return { email, estado: 'no-suscriptor' };
  return { email, estado: data.estado };
}

export async function iniciarCheckout(email) {
  const res = await fetch('/.netlify/functions/crear-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) throw new Error('Error al crear sesión de pago');
  const { url } = await res.json();
  window.location.href = url;
}

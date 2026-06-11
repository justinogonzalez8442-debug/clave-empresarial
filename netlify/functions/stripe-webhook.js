const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];

  // Netlify puede base64-encodear el body; necesitamos el raw para verificar la firma
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { type, data } = stripeEvent;
  const obj = data.object;

  let email, customerId, estado;

  if (type === 'checkout.session.completed') {
    email      = obj.customer_email;
    customerId = obj.customer;
    estado     = 'activo';

  } else if (
    type === 'customer.subscription.created' ||
    type === 'customer.subscription.updated'
  ) {
    customerId = obj.customer;
    estado     = obj.status === 'active' ? 'activo'
               : obj.status === 'past_due' ? 'pago_fallido'
               : 'inactivo';
    const cust = await stripe.customers.retrieve(customerId);
    email = cust.email;

  } else if (type === 'customer.subscription.deleted') {
    customerId = obj.customer;
    estado     = 'cancelado';
    const cust = await stripe.customers.retrieve(customerId);
    email = cust.email;

  } else if (type === 'invoice.payment_failed') {
    customerId = obj.customer;
    estado     = 'pago_fallido';
    const cust = await stripe.customers.retrieve(customerId);
    email = cust.email;

  } else {
    return { statusCode: 200, body: 'Evento ignorado' };
  }

  if (!email) return { statusCode: 200, body: 'Sin email, ignorado' };

  const { error } = await supabase
    .from('suscriptores')
    .upsert({ email, estado, stripe_customer_id: customerId }, { onConflict: 'email' });

  if (error) {
    console.error('Supabase upsert error:', error);
    return { statusCode: 500, body: 'Error guardando en Supabase' };
  }

  return { statusCode: 200, body: 'OK' };
};

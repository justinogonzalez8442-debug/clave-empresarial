const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: 'Body inválido' };
  }

  if (!email) {
    return { statusCode: 400, body: 'Email requerido' };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const baseUrl = process.env.URL || 'http://localhost:8888';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${baseUrl}/archivo.html?suscripcion=ok`,
      cancel_url: `${baseUrl}/archivo.html?suscripcion=cancelado`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return { statusCode: 500, body: err.message };
  }
};

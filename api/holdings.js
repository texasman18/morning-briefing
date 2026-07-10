module.exports = async (req, res) => {
  try {
    const r = await fetch(process.env.RELAY_URL + '/holdings', {
      headers: { 'x-relay-secret': process.env.RELAY_SECRET },
    });
    const text = await r.text();
    res.status(r.status).setHeader('content-type', 'application/json').send(text);
  } catch (e) {
    res.status(500).json({ error: 'holdings-proxy-error', message: String(e.message || e) });
  }
};

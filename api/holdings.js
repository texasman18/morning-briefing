module.exports = async (req, res) => {
  try {
    const r = await fetch(process.env.RELAY_URL + '/holdings', {
      headers: { 'x-relay-secret': process.env.RELAY_SECRET },
    });
    if (!r.ok) {
      const text = await r.text();
      res.status(r.status).setHeader('content-type', 'application/json').send(text);
      return;
    }
    const raw = await r.json();
    const overview = (raw && raw.holdings && raw.holdings.result) || {};

    const items = (overview.items || []).map((it) => ({
      symbol: it.symbol,
      name: it.name,
      market: it.marketCountry,
      currency: it.currency,
      quantity: Number(it.quantity),
      lastPrice: Number(it.lastPrice),
      avgPrice: Number(it.averagePurchasePrice),
      purchaseAmount: it.marketValue ? Number(it.marketValue.purchaseAmount) : null,
      marketValue: it.marketValue ? Number(it.marketValue.amount) : null,
      profitAmount: it.profitLoss ? Number(it.profitLoss.amount) : null,
      profitRate: it.profitLoss ? Number(it.profitLoss.rate) : null,
      dailyAmount: it.dailyProfitLoss ? Number(it.dailyProfitLoss.amount) : null,
      dailyRate: it.dailyProfitLoss ? Number(it.dailyProfitLoss.rate) : null,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      updatedAt: new Date().toISOString(),
      totalPurchaseAmount: {
        krw: overview.totalPurchaseAmount ? Number(overview.totalPurchaseAmount.krw) : 0,
        usd: overview.totalPurchaseAmount ? Number(overview.totalPurchaseAmount.usd) : null,
      },
      marketValue: {
        krw: overview.marketValue && overview.marketValue.amount ? Number(overview.marketValue.amount.krw) : 0,
        usd: overview.marketValue && overview.marketValue.amount ? Number(overview.marketValue.amount.usd) : null,
      },
      profitLoss: {
        krw: overview.profitLoss && overview.profitLoss.amount ? Number(overview.profitLoss.amount.krw) : 0,
        usd: overview.profitLoss && overview.profitLoss.amount ? Number(overview.profitLoss.amount.usd) : null,
        rate: overview.profitLoss ? Number(overview.profitLoss.rate) : null,
      },
      dailyProfitLoss: {
        krw: overview.dailyProfitLoss && overview.dailyProfitLoss.amount ? Number(overview.dailyProfitLoss.amount.krw) : 0,
        usd: overview.dailyProfitLoss && overview.dailyProfitLoss.amount ? Number(overview.dailyProfitLoss.amount.usd) : null,
        rate: overview.dailyProfitLoss ? Number(overview.dailyProfitLoss.rate) : null,
      },
      items,
    });
  } catch (e) {
    res.status(500).json({ error: 'holdings-proxy-error', message: String(e.message || e) });
  }
};

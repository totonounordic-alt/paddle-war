// Cloudflare Pages Function: /api/session (GET), /api/scores (GET, POST)
// Tarvitsee: D1-sidonta nimellä DB, salaisuus SESSION_SECRET
const enc = new TextEncoder();
const BAD = new Set(['ASS','CUM','FAG','FCK','FUC','FUK','JIZ','KKK','NIG','NZI','SEX','SHT','TIT','PRK','PRL','PSK','VTU','HOR','KUS','PEE']);
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
async function sign(data, secret) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, enc.encode(data));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const top = async db => (await db.prepare('SELECT name,score FROM scores ORDER BY score DESC, ts ASC LIMIT 10').all()).results;

export async function onRequest({ request, env, params }) {
  const route = [].concat(params.route || []).join('/');
  const m = request.method;
  if (route === 'scores' && m === 'GET') return json({ scores: await top(env.DB) });
  if (route === 'session' && m === 'GET') {
    const p = `${Date.now()}.${crypto.randomUUID()}`;
    return json({ token: `${p}.${await sign(p, env.SESSION_SECRET)}` });
  }
  if (route === 'scores' && m === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'bad' }, 400); }
    const [t, n, sig] = String(b.token || '').split('.');
    if (!sig || sig !== await sign(`${t}.${n}`, env.SESSION_SECRET)) return json({ error: 'token' }, 403);
    const secs = (Date.now() - Number(t)) / 1000, score = b.score;
    // Pisteitä ei voi kertyä nopeammin kuin ~0,7 s / piste, eikä token vanhene yli tunnissa
    if (!Number.isInteger(score) || score < 1 || score > 999 || secs > 3600 || secs < score * 0.7) return json({ error: 'score' }, 400);
    const iph = (await sign(request.headers.get('CF-Connecting-IP') || '', env.SESSION_SECRET)).slice(0, 16);
    const r = await env.DB.prepare('SELECT COUNT(*) c FROM scores WHERE iph=? AND ts>?').bind(iph, Date.now() - 600000).first();
    if (r.c >= 5) return json({ error: 'rate' }, 429);
    let name = String(b.name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
    if (BAD.has(name)) name = '***';
    try {
      await env.DB.prepare('INSERT INTO scores(name,score,ts,iph,tok) VALUES(?,?,?,?,?)').bind(name, score, Date.now(), iph, n).run();
    } catch { return json({ error: 'used' }, 409 ); }
    return json({ name, scores: await top(env.DB) });
  }
  return json({ error: 'not found' }, 404);
}

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
// Taso (diff) on vapaa tunniste: pienet kirjaimet/numerot, max 12 merkkiä. Uusia tasoja ei tarvitse lisätä tänne.
const lvl = v => (/^[a-z0-9]{1,12}$/.test(String(v || '')) ? String(v) : 'normal');
const top = async (db, d) => (await db.prepare('SELECT name,score FROM scores WHERE diff=? ORDER BY score DESC, ts ASC LIMIT 10').bind(d).all()).results;

export async function onRequest({ request, env, params }) {
  const route = [].concat(params.route || []).join('/');
  const m = request.method;
  const url = new URL(request.url);
  if (route === 'scores' && m === 'GET') return json({ scores: await top(env.DB, lvl(url.searchParams.get('d'))) });
  if (route === 'session' && m === 'GET') {
    const p = `${Date.now()}.${crypto.randomUUID()}.${lvl(url.searchParams.get('d'))}`;
    return json({ token: `${p}.${await sign(p, env.SESSION_SECRET)}` });
  }
  if (route === 'scores' && m === 'POST') {
    let b; try { b = await request.json(); } catch { return json({ error: 'bad' }, 400); }
    const [t, n, d, sig] = String(b.token || '').split('.');
    if (!sig || sig !== await sign(`${t}.${n}.${d}`, env.SESSION_SECRET) || lvl(d) !== d) return json({ error: 'token' }, 403);
    const secs = (Date.now() - Number(t)) / 1000, score = b.score;
    // Pisteitä ei voi kertyä nopeammin kuin ~0,1 s / piste (tietokoneen virhe antaa +5), eikä token vanhene yli tunnissa
    if (!Number.isInteger(score) || score < 1 || score > 999 || secs > 3600 || secs < score * 0.1) return json({ error: 'score' }, 400);
    const iph = (await sign(request.headers.get('CF-Connecting-IP') || '', env.SESSION_SECRET)).slice(0, 16);
    const r = await env.DB.prepare('SELECT COUNT(*) c FROM scores WHERE iph=? AND ts>?').bind(iph, Date.now() - 600000).first();
    if (r.c >= 5) return json({ error: 'rate' }, 429);
    let name = String(b.name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
    if (BAD.has(name)) name = '***';
    try {
      await env.DB.prepare('INSERT INTO scores(name,score,ts,iph,tok,diff) VALUES(?,?,?,?,?,?)').bind(name, score, Date.now(), iph, n, d).run();
    } catch { return json({ error: 'used' }, 409 ); }
    return json({ name, scores: await top(env.DB, d) });
  }
  return json({ error: 'not found' }, 404);
}

/* Calculation helpers: IPv4 subnet, VLSM, IPv6 subnet. */
const Calc = (() => {
  const toInt = ip => { const p = ip.trim().split('.').map(Number);
    if (p.length !== 4 || p.some(n => !(n >= 0 && n <= 255) || !Number.isInteger(n))) throw new Error('Invalid IPv4 address: ' + ip);
    return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]; };
  const toIp = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  const maskInt = c => c === 0 ? 0 : ((0xFFFFFFFF << (32 - c)) >>> 0);
  const cls = ip => { const f = +ip.split('.')[0]; return f < 128 ? 'A' : f < 192 ? 'B' : f < 224 ? 'C' : f < 240 ? 'D (multicast)' : 'E'; };

  function ipv4(ip, cidr) {
    cidr = +cidr; if (!(cidr >= 0 && cidr <= 32)) throw new Error('Prefix must be 0-32');
    const a = toInt(ip), m = maskInt(cidr), net = (a & m) >>> 0, bc = (net | (~m >>> 0)) >>> 0;
    const size = Math.pow(2, 32 - cidr), usable = cidr >= 31 ? (cidr === 31 ? 2 : 1) : size - 2;
    return { class: cls(ip), mask: toIp(m), network: toIp(net), broadcast: toIp(bc),
      first: cidr >= 31 ? toIp(net) : toIp(net + 1), last: cidr >= 31 ? toIp(bc) : toIp(bc - 1),
      usable, total: size, block: size, wildcard: toIp(~m >>> 0) };
  }

  function vlsm(base, reqs) {
    const [ip, c] = base.split('/'); let cidr = +c;
    let cur = (toInt(ip) & maskInt(cidr)) >>> 0; const end = cur + Math.pow(2, 32 - cidr);
    const list = reqs.filter(r => r.hosts > 0).slice().sort((x, y) => y.hosts - x.hosts); const rows = [];
    for (const r of list) {
      let h = 2; while (Math.pow(2, h) - 2 < r.hosts) h++;
      const size = Math.pow(2, h), p = 32 - h;
      if (cur + size > end) { rows.push({ name: r.name, need: r.hosts, error: 'Out of address space' }); continue; }
      rows.push({ name: r.name, need: r.hosts, network: toIp(cur), prefix: '/' + p, mask: toIp(maskInt(p)),
        first: toIp(cur + 1), last: toIp(cur + size - 2), usable: size - 2, broadcast: toIp(cur + size - 1), block: size });
      cur += size;
    }
    return rows;
  }

  /* ---- IPv6 ---- */
  function expand6(addr) {
    addr = addr.trim().toLowerCase(); if (addr.split('::').length > 2) throw new Error('Only one :: allowed');
    let [l, r] = addr.includes('::') ? addr.split('::') : [addr, null];
    const L = l ? l.split(':') : [], R = r ? r.split(':') : [];
    let parts = r === null ? L : [...L, ...Array(8 - L.length - R.length).fill('0'), ...R];
    if (parts.length !== 8 || parts.some(p => !/^[0-9a-f]{1,4}$/.test(p))) throw new Error('Invalid IPv6 address');
    return parts.map(p => p.padStart(4, '0'));
  }
  const big6 = a => BigInt('0x' + expand6(a).join(''));
  const full6 = n => { const h = n.toString(16).padStart(32, '0'); return h.match(/.{4}/g).join(':'); };
  function short6(full) {
    const g = full.split(':').map(x => x.replace(/^0+(?=.)/, ''));
    let best = [-1, 0], i = 0;
    while (i < 8) { if (g[i] === '0') { let j = i; while (j < 8 && g[j] === '0') j++; if (j - i > best[1]) best = [i, j - i]; i = j; } else i++; }
    if (best[1] < 2) return g.join(':');
    const s = g.slice(0, best[0]).join(':'), e = g.slice(best[0] + best[1]).join(':');
    return s + '::' + e;
  }
  function ipv6(addr, from, to, limit = 64) {
    from = +from; to = +to; if (!(from >= 0 && to >= from && to <= 128)) throw new Error('Need 0 ≤ original ≤ new ≤ 128');
    const borrowed = to - from, count = 2n ** BigInt(borrowed), shown = Number(count > BigInt(limit) ? BigInt(limit) : count);
    const base = (big6(addr) >> BigInt(128 - from)) << BigInt(128 - from), step = 1n << BigInt(128 - to), rows = [];
    for (let i = 0; i < shown; i++) { const s = base + step * BigInt(i), e = s + step - 1n;
      rows.push({ n: i + 1, prefix: short6(full6(s)) + '/' + to, first: short6(full6(s)), last: short6(full6(e)), lastFull: full6(e) }); }
    return { borrowed, count: count.toString(), increment: (to > 48 && to <= 64) ? '0x' + (step >> 64n).toString(16).padStart(4, '0') + ' (4th hextet)' : '0x' + step.toString(16), shown, rows,
      slash64: (2n ** BigInt(Math.max(0, 64 - to))).toString() };
  }
  return { ipv4, vlsm, ipv6, expand6, short6, full6 };
})();

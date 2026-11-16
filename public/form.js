(() => {
  // Lead submit, with an offline queue for poor signal at the door.
  const f = document.getElementById('f'), msg = document.getElementById('msg'), b = document.getElementById('b');
  const KEY = 'insight-pending', q = new URLSearchParams(location.search);
  const done = () => { f.innerHTML = '<div class="done"><img class="mark" src="/brand/mark-colour.png" alt="Insight"><h2>Thanks, you\'re all set.</h2><p>Our team will give you a call soon.</p></div>'; };
  const send = async (data) => {
    const r = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Something went wrong. Please try again.'); e.user = true; throw e; }
  };
  const get = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const set = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };
  const flush = async () => { const p = get(); if (!p) return; try { await send(p); set(null); done(); } catch (e) { if (e.user) set(null); } };
  addEventListener('online', flush); flush();

  // Pest dropdown: show what's picked in the closed field.
  const pick = document.getElementById('pick'), pickLabel = document.getElementById('pickLabel');
  const showPicked = () => {
    const names = [...f.querySelectorAll('input[name="pests"]:checked')].map((c) => c.nextElementSibling.textContent);
    // Two names fit on a phone; past that, show a count so the field never overflows.
    pickLabel.textContent = !names.length ? 'Choose any that apply' : names.length <= 2 ? names.join(', ') : `${names[0]} and ${names.length - 1} more`;
    pickLabel.classList.toggle('ph', !names.length);
  };
  f.addEventListener('change', (ev) => { if (ev.target.name === 'pests') showPicked(); });
  document.getElementById('pickDone').addEventListener('click', () => { pick.open = false; pick.querySelector('summary').focus(); });

  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f), data = Object.fromEntries(fd);
    data.pests = fd.getAll('pests'); data.src = q.get('src') || 'qr'; data.rep = q.get('rep') || '';
    if (!data.name.trim() || !data.phone.trim() || !data.email.trim() || !data.suburb.trim()) { msg.textContent = 'Please fill in your name, mobile, email and suburb.'; return; }
    b.disabled = true; msg.textContent = ''; b.textContent = 'Sending...';
    try { await send(data); done(); }
    catch (e) {
      b.disabled = false; b.textContent = 'Call me back';
      if (e.user) { msg.textContent = e.message; return; }
      set(data); msg.textContent = 'No signal right now. Your details are saved on this device and will send once you are back online.';
    }
  });
})();

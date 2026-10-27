import { createServer } from 'node:http';

/**
 * A fake dashboard and a fake Keycloak on two local origins, so the harness exercises the
 * same redirect, form and token round trip as st — with a synthetic password.
 *
 * Dashboard: `/` needs the session cookie, else it redirects to the login. `/?write=1`
 * fires a business POST, `/?broken=1` asks an API that answers 500. Every request that
 * reaches the dashboard is counted in `seen`, so the test can prove a write never arrived.
 */
export async function startServers(password) {
  const seen = { apiWrites: 0, tokenPosts: 0 };
  const app = createServer();
  const auth = createServer();
  await Promise.all([listen(app), listen(auth)]);
  const appOrigin = `http://127.0.0.1:${app.address().port}`;
  const authOrigin = `http://127.0.0.1:${auth.address().port}`;

  app.on('request', (req, res) => {
    const url = new URL(req.url, appOrigin);
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET') seen.apiWrites++;
      const ok = url.pathname !== '/api/v1/broken';
      res.writeHead(ok ? 200 : 500, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ success: ok, data: ok ? [] : null }));
    }
    if (url.searchParams.get('code') === 'ok') {
      res.writeHead(302, { 'set-cookie': 'session=ok; Path=/', location: '/' });
      return res.end();
    }
    if (!/(^|; )session=ok/.test(req.headers.cookie ?? '')) {
      res.writeHead(302, { location: `${authOrigin}/realms/test/login` });
      return res.end();
    }
    const script = url.searchParams.has('write')
      ? `fetch('/api/v1/newcomers', { method: 'POST', body: '{}' }).catch(() => {});`
      : url.searchParams.has('broken') ? `fetch('/api/v1/broken');` : '';
    html(res, `<header>Shell</header><nav aria-label="Main navigation"><a href="/">Home</a></nav>
      <main><h1>Home</h1></main><script>${script}</script>`);
  });

  auth.on('request', (req, res) => {
    const url = new URL(req.url, authOrigin);
    if (req.method === 'POST' && url.pathname === '/realms/test/login-actions/authenticate') {
      seen.tokenPosts++;
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        if (new URLSearchParams(body).get('password') === password) {
          res.writeHead(302, { location: `${appOrigin}/?code=ok` });
          return res.end();
        }
        html(res, form('<span id="input-error">Invalid username or password.</span>'));
      });
      return;
    }
    html(res, form(''));
  });

  return {
    appOrigin,
    seen,
    close: () => Promise.all([close(app), close(auth)]),
  };
}

function form(error) {
  return `<form method="post" action="/realms/test/login-actions/authenticate">${error}
    <input id="username" name="username"><input id="password" name="password" type="password">
    <button id="kc-login" type="submit">Sign in</button></form>`;
}

function html(res, body) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html><body>${body}</body></html>`);
}

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise(resolve => server.close(() => resolve()));
}

function manifestHost(baseUrl, basePath) {
  const url = new URL(baseUrl);
  const path = basePath.replace(/^\/+|\/+$/g, '');
  return `${url.host}${path ? `/${path}` : ''}`;
}

module.exports = { manifestHost };
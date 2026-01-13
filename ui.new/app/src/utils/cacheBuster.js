function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
}
function genAntiCachePrefix() {
  const requestId = generateRequestId();
  const cacheBuster = `[REQ:${requestId}]`;

  return `${cacheBuster} You are in strict mode. Follow the instructions exactly. `;
}

module.exports = {genAntiCachePrefix}

const util = require("util");

function getAuthToken(apiReq) {
  const auth = apiReq.headers.authorization;
  if (auth.startsWith("Bearer ")) {
    const jwtEncoded = auth.replace("Bearer ", "").trim();
    try {
      if(!jwtEncoded || jwtEncoded === 'null') return {}
      const jwt =JSON.parse(Buffer.from(jwtEncoded, "base64").toString("utf-8"));
      return jwt;
    } catch (ex) {
      console.error({ jwt: ex });
    }
  }
  return {};
}

function deepMerge(target, source) {
  for (const key in source) 
    if (source[key] instanceof Object && key in target) 
      Object.assign(source[key], deepMerge(target[key], source[key]));
  return Object.assign(target, source);
}

module.exports = {
  deepLog: (obj) => console.log(util.inspect(obj, { showHidden: false, depth: null, colors: true })),
  stripText: (text, maxLen = 50) => text.substring(0, maxLen).replace(/\n/g, "\\n") + (text.length > maxLen ? "..." : ""),
  getAuthToken,
  deepMerge
};

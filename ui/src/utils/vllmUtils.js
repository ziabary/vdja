async function callVLLMStream(url, model, messages, params = {}) {
  const defaultParams = {
    max_tokens: 1500,
    temperature: 0.4,
    stream: true,
    ...params,
  };

  const response = await fetch(`${url}v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      ...defaultParams,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`vLLM error ${response.status}: ${errorText}`);
  }

  return response;
}

module.exports = { callVLLMStream };
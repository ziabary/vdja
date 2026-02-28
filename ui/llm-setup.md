# 31.14.121.178 -> ui
    - vllm: [gpu-0,2] aya no-port -> rag
    - vllm2: [gpu-3] aya 8004 -> translation
    - embedding: [gpu-1] multilingual-e5-large-instruct no-port
    - qdrant: [gpu-1] no-port

# 31.14.120.138 -> ui-2
    - vllm: [gpu-0,3] qwen32   8000 -> think
    - vllm2: [gpu-1]  aya      8001 -> translation
    - embedding [gpu-2] multilingual-e5-large-instruct  no-port
    
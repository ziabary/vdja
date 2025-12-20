#!/bin/sh
name=vadja
docker rm -f $name-aya $name-qdrant $name-embd
docker run -d --name $name-aya --gpus '"device=0,1"' --ipc=host --shm-size=8g \
	  -v ./:/workspace \
          -p 8000:8000 \
	  -e HF_HUB_OFFLINE=1 \
          -e TRANSFORMERS_OFFLINE=1 \
	  -e HF_HUB_ENABLE_HF_TRANSFER=0 \
	  -e VLLM_SKIP_WARMUP=true \
          vllm:25.11-py3 \
	  python -m vllm.entrypoints.openai.api_server \
	  --model /workspace/models/aya-expanse-8b \
	  --served-model-name aya-expanse-8b \
	  --served-model-name aya \
          --tensor-parallel-size 2 \
	  --dtype auto \
	  --max-model-len 8192 \
	  --gpu-memory-utilization 0.85 \
          --port 8000

docker run -d --ipc=host --shm-size=8g \
  --name $name-embd   \
  -v ./:/workspace \
  --gpus '"device=2"' \
  -p 8001:8001 \
  -e HF_HUB_OFFLINE=1 \
  -e TRANSFORMERS_OFFLINE=1 \
  -e HF_HUB_ENABLE_HF_TRANSFER=0 \
  -e VLLM_SKIP_WARMUP=true \
  vllm:25.11-py3 \
  python -m vllm.entrypoints.openai.api_server \
  --model /workspace/models/multilingual-e5-large-instruct \
  --served-model-name multilingual-e5-large-instruct \
  --port 8001 \
  --tensor-parallel-size 1 \
  --dtype half \
  --max-model-len 512 \
  --enforce-eager \
  --gpu-memory-utilization 0.65
  

CUDA_VISIBLE_DEVICES=2 docker run -d \
  --name $name-qdrant \
  -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  --gpus '"device=2"' \
  docker.arvancloud.ir/qdrant/qdrant:latest


docker run -d -p 3000:3000 -v ./db:/app/db -v .env:/app/.env vdja-ui:1.0 


docker logs -f $name-aya

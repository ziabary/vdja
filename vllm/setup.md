عالی! حالا دقیقاً در مرحله‌ای هستید که همه چیز آماده است.
از این به بعد همه دستورات را روی **هاست** (خارج از کانتینر) اجرا کنید، مگر اینکه بگویم داخل کانتینر بروید.

### قدم بعدی: فولدرهای محلی بسازید و مدل را دانلود کنید

```bash
# ۱. فولدرهای کاری بسازید (یک بار کافی است)
mkdir -p ~/vllm-aya/{models,data,rag_index}

# ۲. وارد کانتینر بشوید تا مدل را دانلود کنیم (این بار فقط برای دانلود)
docker run --rm -it --gpus all --ipc=host \
  -v ~/vllm-aya:/workspace \
  nvcr.io/nvidia/vllm:25.11-py3 bash
```

داخل کانتینر این دستورات را بزنید:

```bash
# ۲.1 لاگین به Hugging Face (فقط یک بار)
huggingface-cli login
# → توکن را از اینجا بگیرید: https://huggingface.co/settings/tokens (Read دسترسی کافی است)
# توکن را paste کنید و Enter بزنید

# ۲.۲ دانلود Aya-23-8B (حدود ۱۶ گیگ، ۱۵–۴۰ دقیقه بسته به اینترنت)
cd /workspace/models
git lfs install
git clone https://huggingface.co/CohereForAI/aya-23-8B
# یا روش سریع‌تر (توصیه می‌کنم):
# snapshot_download(repo_id="CohereForAI/aya-23-8B", local_dir="/workspace/models/aya-23-8B", local_dir_use_symlinks=False)

# ۲.۳ چک کنید که فایل‌ها دانلود شده باشند
ls -lh aya-23-8B | grep -E "(pytorch_model|generation_config|config)"
```

بعد از اینکه دیدید همه فایل‌ها (مثل `pytorch_model-00001-of-00003.bin` و غیره) دانلود شدند، از کانتینر خارج شوید:

```bash
exit
```

### قدم بعدی: سرور vLLM را با ۵ کارت RTX 4090 راه بیندازید

```bash
# ۳. اجرای سرور (این دستور را روی هاست بزنید)
docker run -d --name aya-vllm-server --gpus all --ipc=host --shm-size=8g \
  -v ~/vllm-aya:/workspace \
  -p 8000:8000 \
  nvcr.io/nvidia/vllm:25.11-py3 \
  python -m vllm.entrypoints.openai.api_server \
    --model /workspace/models/aya-23-8B \
    --tensor-parallel-size 5 \
    --dtype float16 \
    --max-model-len 8192 \
    --gpu-memory-utilization 0.95 \
    --trust-remote-code \
    --enforce-eager \
    --port 8000
```

چند ثانیه صبر کنید و لاگ‌ها را چک کنید:

```bash
docker logs -f aya-vllm-server
```

وقتی این خط را دیدید یعنی سرور کاملاً آماده است:

```
Uvicorn running on http://0.0.0.0:8000
```

### تست سریع (روی هاست)

```bash
curl http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "aya-23-8B",
    "prompt": "به فارسی توضیح بده انقلاب مشروطه ایران چه بود؟",
    "max_tokens": 200,
    "temperature": 0.7
  }' | jq -r .choices[0].text
```

اگر جواب فارسی و درست داد → تبریک! مدل روی ۵ کارت ۴۰۹۰ با سرعت بالا و پایدار در حال اجراست.

### بعدی چی؟
بگویید «OK» یا «آماده RAG» تا دقیقاً اسکریپت FAISS + RAG را با همین ساختار برایتان بفرستم (۱۰ دقیقه کار دارد).

اگر هم می‌خواهید همین الان quantized (AWQ 4-bit) کنید تا حافظه کمتر مصرف کند و همزمان ۳۰۰–۵۰۰ کاربر را راحت ساپورت کند، بگویید تا لینک مدل آماده و دستوراتش را بدهم.

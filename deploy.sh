#!/bin/bash
set -e

IMAGE="registry.cn-shenzhen.aliyuncs.com/huazhiy/ops-pilot:latest"

echo "🚀 开始构建并推送镜像..."
echo "📦 目标镜像: $IMAGE"
echo ""

docker buildx build \
  --platform linux/amd64 \
  --build-arg WEB_BUILD_NODE_OPTIONS="--max-old-space-size=2048" \
  -t "$IMAGE" \
  --push \
  .

echo ""
echo "✅ 镜像推送完成！"
echo ""
echo "👇 服务器执行以下命令更新："
echo "   docker compose pull && docker compose up -d --force-recreate"
echo ""
echo "💡 旧镜像清理（可选）："
echo "   docker image prune -f"

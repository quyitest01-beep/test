# n8n AWS S3 下载节点配置修复指南

## 问题描述
n8n的AWS S3节点无法下载文件，因为缺少必要的`operation`参数。

## 解决方案

### 正确的n8n AWS S3节点配置

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "download",
        "bucketName": "aws-athena-query-results-us-west-2-034986663036",
        "fileKey": "={{ $json.fileInfo.fileKey }}"
      },
      "type": "n8n-nodes-base.awsS3",
      "typeVersion": 2,
      "position": [-5440, 128],
      "id": "9a89c112-d678-4d7c-9b77-896f62eb2a17",
      "name": "获取查询文件2",
      "credentials": {
        "aws": {
          "id": "zyGk0J5eZJwUactt",
          "name": "AWS account"
        }
      },
      "onError": "continueRegularOutput"
    }
  ],
  "connections": {
    "获取查询文件2": {
      "main": [[]]
    }
  }
}
```

## 关键配置项

1. **operation**: `"download"` - 必须指定操作类型为下载
2. **bucketName**: S3存储桶名称
3. **fileKey**: 文件路径（支持表达式）

## 其他可用的operation值

- `upload` - 上传文件
- `download` - 下载文件
- `delete` - 删除文件
- `list` - 列出文件

## 注意事项

- 确保AWS凭证配置正确
- fileKey必须是完整的文件路径（不包含bucket名称）
- 如果文件不存在，节点会报错（除非设置了`onError: "continueRegularOutput"`）

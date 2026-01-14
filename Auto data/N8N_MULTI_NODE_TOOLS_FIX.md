# n8n 多节点工具名称冲突修复指南

## 问题：You have multiple tools with the same name: '_'

当工作流中有多个 AI Agent 节点时，如果工具没有明确指定名称，系统会使用默认名称 `_`，导致冲突。

## 快速修复步骤

### 步骤1：检查所有 AI Agent 节点

在你的工作流中，检查以下节点是否配置了工具：
- "生成SQL"
- "查现有场景"
- "查对应知识库"
- "查SQL模板"

### 步骤2：为每个节点的工具指定唯一名称

#### 节点："查现有场景"
需要配置的工具：
- **工具1**：名称设置为 `getKnowledgeBaseScenario`（获取知识库场景）
- **工具2**：名称设置为 `checkKnowledgeBase`（查对应知识库）

配置示例：
```
工具配置：
1. getKnowledgeBaseScenario - 获取知识库场景
2. checkKnowledgeBase - 查对应知识库
```

#### 节点："查对应知识库"
需要配置的工具：
- **工具1**：名称设置为 `getKnowledgeBaseDirectory`（获取知识库目录）
- **工具2**：名称设置为 `getSQLTemplate`（查SQL模板）

配置示例：
```
工具配置：
1. getKnowledgeBaseDirectory - 获取知识库目录
2. getSQLTemplate - 查SQL模板
```

#### 节点："查SQL模板"
需要配置的工具：
- **工具1**：名称设置为 `getSpecifiedKnowledgeBase`（获取指定知识库）

配置示例：
```
工具配置：
1. getSpecifiedKnowledgeBase - 获取指定知识库
```

### 步骤3：在 n8n 中修复

1. **打开每个 AI Agent 节点**
2. **找到 "Tools" 或 "工具" 配置部分**
3. **检查每个工具是否有明确的名称**
4. **如果没有名称或名称为 `_`，按以下方式修复**：

#### 修复方法A：在工具配置中指定名称

如果工具是通过 n8n 的工具配置界面添加的：
1. 点击工具配置
2. 找到 "Name" 或 "名称" 字段
3. 输入唯一的名称（如 `getKnowledgeBaseScenario`）
4. 保存

#### 修复方法B：删除并重新添加工具

如果无法直接修改名称：
1. 删除所有工具
2. 重新添加工具，确保每个工具都有唯一的名称
3. 保存配置

### 步骤4：验证工具名称唯一性

确保整个工作流中所有工具的名称都是唯一的：

| 节点 | 工具名称 | 用途 |
|------|---------|------|
| 查现有场景 | `getKnowledgeBaseScenario` | 获取知识库场景 |
| 查现有场景 | `checkKnowledgeBase` | 查对应知识库 |
| 查对应知识库 | `getKnowledgeBaseDirectory` | 获取知识库目录 |
| 查对应知识库 | `getSQLTemplate` | 查SQL模板 |
| 查SQL模板 | `getSpecifiedKnowledgeBase` | 获取指定知识库 |

## 详细修复流程

### 1. 修复 "查现有场景" 节点

1. 打开 "查现有场景" AI Agent 节点
2. 找到 Tools 配置
3. 检查工具列表：
   - 如果看到工具名称为 `_` 或空，需要重命名
   - 第一个工具重命名为：`getKnowledgeBaseScenario`
   - 第二个工具重命名为：`checkKnowledgeBase`
4. 保存节点

### 2. 修复 "查对应知识库" 节点

1. 打开 "查对应知识库" AI Agent 节点
2. 找到 Tools 配置
3. 检查工具列表：
   - 第一个工具重命名为：`getKnowledgeBaseDirectory`
   - 第二个工具重命名为：`getSQLTemplate`
4. 保存节点

### 3. 修复 "查SQL模板" 节点

1. 打开 "查SQL模板" AI Agent 节点
2. 找到 Tools 配置
3. 检查工具列表：
   - 工具重命名为：`getSpecifiedKnowledgeBase`
4. 保存节点

## 常见问题

### Q1: 找不到工具名称配置选项

**A**: 某些版本的 n8n 可能需要在工具的高级配置中设置名称。尝试：
1. 点击工具配置的 "Advanced" 或 "高级" 选项
2. 查找 "Name"、"Identifier" 或 "名称" 字段
3. 如果仍然找不到，可能需要删除工具并重新添加

### Q2: 删除工具后无法重新添加

**A**: 确保：
1. 工具节点（如 HTTP Request 节点）已经正确配置
2. 工具节点有唯一的名称
3. 在 AI Agent 节点中正确引用了工具节点

### Q3: 修复后仍然报错

**A**: 尝试：
1. 保存整个工作流
2. 刷新页面
3. 重新打开工作流
4. 检查是否还有其他节点使用了相同的工具名称

## 预防措施

1. **始终为工具指定明确的名称**：不要依赖系统自动生成的名称
2. **使用有意义的名称**：使用描述性的名称，如 `getKnowledgeBaseScenario` 而不是 `tool1`
3. **检查工具名称唯一性**：在添加新工具前，检查工作流中是否已有相同名称的工具
4. **定期检查工具配置**：在修改工作流后，检查所有 AI Agent 节点的工具配置

## 工具名称命名规范

建议使用以下命名规范：

- **格式**：`动词 + 名词`，使用驼峰命名法
- **示例**：
  - `getKnowledgeBaseScenario` - 获取知识库场景
  - `getKnowledgeBaseDirectory` - 获取知识库目录
  - `getSpecifiedKnowledgeBase` - 获取指定知识库
  - `checkKnowledgeBase` - 检查知识库
  - `getSQLTemplate` - 获取SQL模板

## 验证清单

修复完成后，请检查：

- [ ] 所有 AI Agent 节点的工具都有明确的名称
- [ ] 所有工具名称都是唯一的（在整个工作流中）
- [ ] 没有工具使用默认名称 `_`
- [ ] 保存工作流后没有错误提示
- [ ] 可以正常执行工作流


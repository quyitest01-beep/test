# Requirements Document

## Introduction

修复n8n工作流中"Convert to XLSX"节点生成的文件格式问题。当前下载的文件无法被Excel正常打开，需要确保生成的xlsx文件符合标准格式。

## Glossary

- **n8n**: 工作流自动化平台
- **Convert_to_XLSX_Node**: n8n中用于将数据转换为xlsx格式的节点
- **Binary_Data**: n8n中存储文件内容的二进制数据格式
- **Output_Field**: n8n节点中指定输出数据存储位置的字段名
- **MIME_Type**: 文件的媒体类型标识符
- **Content_Disposition**: HTTP响应头，指定文件下载时的文件名

## Requirements

### Requirement 1: 诊断xlsx文件格式问题

**User Story:** 作为开发者，我想要诊断当前生成的xlsx文件为什么无法正常打开，以便找到根本原因。

#### Acceptance Criteria

1. WHEN 检查n8n节点输出时，THE System SHALL 验证Binary_Data的MIME_Type是否正确设置为`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
2. WHEN 检查文件内容时，THE System SHALL 验证文件是否包含有效的xlsx文件头（PK zip格式）
3. WHEN 检查节点配置时，THE System SHALL 验证Output_Field名称是否正确设置
4. WHEN 检查数据结构时，THE System SHALL 验证输入数据是否为有效的JSON数组格式

### Requirement 2: 修复xlsx文件生成

**User Story:** 作为用户，我想要下载的xlsx文件能够被Excel正常打开，以便查看查询结果。

#### Acceptance Criteria

1. WHEN Convert_to_XLSX_Node生成文件时，THE System SHALL 确保输出的Binary_Data包含有效的xlsx文件内容
2. WHEN 设置文件名时，THE System SHALL 使用正确的Content_Disposition头，支持中文文件名
3. WHEN 数据包含特殊字符时，THE System SHALL 正确转义和编码所有字符
4. WHEN 下载文件后，THE System SHALL 确保文件可以被Microsoft Excel或WPS正常打开

### Requirement 3: 验证数据转换流程

**User Story:** 作为开发者，我想要验证从查询结果到xlsx文件的完整转换流程，以确保每个环节都正确。

#### Acceptance Criteria

1. WHEN 查询结果返回时，THE System SHALL 验证数据格式为标准JSON数组
2. WHEN 传递给Convert_to_XLSX_Node时，THE System SHALL 确保数据结构符合节点要求
3. WHEN 节点处理数据时，THE System SHALL 正确映射所有字段和值
4. WHEN 生成二进制数据时，THE System SHALL 使用ExcelJS或类似库生成标准xlsx格式

### Requirement 4: 提供替代方案

**User Story:** 作为开发者，如果n8n内置节点有问题，我想要使用后端API作为替代方案，以确保功能可用。

#### Acceptance Criteria

1. WHEN n8n节点无法正常工作时，THE System SHALL 提供使用后端`/api/export`端点的替代方案
2. WHEN 使用后端API时，THE System SHALL 支持相同的数据输入格式
3. WHEN 通过API导出时，THE System SHALL 返回可直接下载的xlsx文件
4. WHEN 文件生成完成时，THE System SHALL 提供文件下载URL或直接返回文件流

### Requirement 5: 添加调试和日志

**User Story:** 作为开发者，我想要详细的调试信息，以便快速定位问题。

#### Acceptance Criteria

1. WHEN 节点执行时，THE System SHALL 记录输入数据的结构和大小
2. WHEN 文件生成时，THE System SHALL 记录生成的文件大小和MIME类型
3. WHEN 发生错误时，THE System SHALL 提供详细的错误信息和堆栈跟踪
4. WHEN 调试模式启用时，THE System SHALL 输出中间步骤的数据样本

### Requirement 6: 修复工作流执行错误

**User Story:** 作为用户，我想要工作流能够正常执行，不出现"Problems executing workflow"或"Problems running workflow"错误。

#### Acceptance Criteria

1. WHEN 节点之间传递数据时，THE System SHALL 确保数据格式兼容
2. WHEN HTTP_Request节点调用API时，THE System SHALL 正确设置所有必需的headers和body
3. WHEN Merge节点合并数据时，THE System SHALL 使用正确的合并模式
4. WHEN 后端服务不可用时，THE System SHALL 提供清晰的错误提示
5. WHEN 工作流执行失败时，THE System SHALL 在错误节点显示具体的失败原因

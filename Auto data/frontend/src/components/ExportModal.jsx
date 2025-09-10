import React, { useState } from 'react';
import { Modal, Form, Select, Input, Switch, InputNumber, Radio, Button, message, Progress } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FileTextOutlined } from '@ant-design/icons';
import { queryAPI } from '../services/api';

const { Option } = Select;

const ExportModal = ({ visible, onCancel, data, queryId }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportResult, setExportResult] = useState(null);

  const handleExport = async (values) => {
    setLoading(true);
    setExportProgress(0);
    setExportResult(null);

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      let result;
      if (queryId) {
        // 导出查询结果
        result = await queryAPI.exportQueryResult({
          queryId,
          format: values.format,
          options: {
            filename: values.filename,
            sheetName: values.sheetName,
            strategy: values.strategy,
            maxRowsPerSheet: values.maxRowsPerSheet,
            maxRowsPerFile: values.maxRowsPerFile,
            includeMetadata: values.includeMetadata
          }
        });
      } else {
        // 导出数据
        result = await queryAPI.exportData({
          data,
          format: values.format,
          options: {
            filename: values.filename,
            sheetName: values.sheetName,
            strategy: values.strategy,
            maxRowsPerSheet: values.maxRowsPerSheet,
            maxRowsPerFile: values.maxRowsPerFile,
            includeMetadata: values.includeMetadata
          }
        });
      }

      clearInterval(progressInterval);
      setExportProgress(100);
      setExportResult(result.data);
      
      message.success('导出成功！');
    } catch (error) {
      console.error('Export failed:', error);
      message.error(`导出失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (downloadUrl, filename) => {
    const link = document.createElement('a');
    link.href = `http://localhost:8000${downloadUrl}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetModal = () => {
    form.resetFields();
    setExportProgress(0);
    setExportResult(null);
    setLoading(false);
  };

  const handleCancel = () => {
    resetModal();
    onCancel();
  };

  const getDataSize = () => {
    if (queryId) return '查询结果';
    return data ? data.length : 0;
  };

  const getRecommendedStrategy = () => {
    const size = Array.isArray(data) ? data.length : 0;
    if (size <= 100000) return 'single';
    if (size <= 1000000) return 'multi-sheet';
    return 'multi-file';
  };

  return (
    <Modal
      title="导出数据"
      open={visible}
      onCancel={handleCancel}
      width={600}
      footer={null}
    >
      {!exportResult ? (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleExport}
          initialValues={{
            format: 'excel',
            filename: `export_${Date.now()}`,
            sheetName: 'Query Results',
            strategy: 'auto',
            maxRowsPerSheet: 1000000,
            maxRowsPerFile: 1000000,
            includeMetadata: true
          }}
        >
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
            <p><strong>数据规模:</strong> {getDataSize()} 条记录</p>
            <p><strong>建议策略:</strong> {getRecommendedStrategy()}</p>
          </div>

          <Form.Item
            label="导出格式"
            name="format"
            rules={[{ required: true, message: '请选择导出格式' }]}
          >
            <Radio.Group>
              <Radio.Button value="excel">
                <FileExcelOutlined /> Excel (.xlsx)
              </Radio.Button>
              <Radio.Button value="csv">
                <FileTextOutlined /> CSV (.csv)
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label="文件名"
            name="filename"
            rules={[
              { required: true, message: '请输入文件名' },
              { pattern: /^[a-zA-Z0-9_-]+$/, message: '文件名只能包含字母、数字、下划线和连字符' }
            ]}
          >
            <Input placeholder="export_data" />
          </Form.Item>

          <Form.Item
            label="工作表名称"
            name="sheetName"
          >
            <Input placeholder="Query Results" />
          </Form.Item>

          <Form.Item
            label="导出策略"
            name="strategy"
            help="自动：根据数据量自动选择最佳策略"
          >
            <Select>
                <Option value="auto">自动选择</Option>
                <Option value="single">单文件 (小于等于10万行)</Option>
                <Option value="multi-sheet">多工作表 (小于等于100万行)</Option>
                <Option value="multi-file">多文件 (大于100万行)</Option>
              </Select>
          </Form.Item>

          <Form.Item
            label="每个工作表最大行数"
            name="maxRowsPerSheet"
          >
            <InputNumber
              min={1000}
              max={1048576}
              step={10000}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item
            label="每个文件最大行数"
            name="maxRowsPerFile"
          >
            <InputNumber
              min={1000}
              max={10000000}
              step={100000}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item
            label="包含元数据"
            name="includeMetadata"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>

          {loading && (
            <div style={{ marginBottom: 16 }}>
              <p>正在导出数据...</p>
              <Progress percent={exportProgress} status="active" />
            </div>
          )}

          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={handleCancel}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading} icon={<DownloadOutlined />}>
                开始导出
              </Button>
            </div>
          </Form.Item>
        </Form>
      ) : (
        <div>
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
            <h4 style={{ color: '#52c41a', margin: 0 }}>导出完成！</h4>
            <p style={{ margin: '8px 0 0 0' }}>成功导出 {exportResult.totalRows} 条记录</p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <h4>导出信息:</h4>
            <p><strong>导出策略:</strong> {exportResult.strategy}</p>
            <p><strong>文件数量:</strong> {exportResult.totalFiles}</p>
            {exportResult.totalSheets && (
              <p><strong>工作表数量:</strong> {exportResult.totalSheets}</p>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <h4>下载文件:</h4>
            {exportResult.downloadUrls.map((file, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                marginBottom: 8
              }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{file.filename}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB • {file.rows} 行
                  </div>
                </div>
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(file.url, file.filename)}
                >
                  下载
                </Button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleCancel}>
              关闭
            </Button>
            <Button type="primary" onClick={resetModal}>
              重新导出
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ExportModal;
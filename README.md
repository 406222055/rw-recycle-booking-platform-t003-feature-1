# 旧物回收上门预约服务平台

旧物回收上门预约服务平台 MVP，采用无构建前端页面 + Node.js 内置 HTTP 服务。项目按参考结构组织，根目录下只放工程配置与说明，业务实现放在 `frontend` 和 `backend`。

## Directory layout

- `frontend`：预约提交、预约列表、筛选搜索、运营处理页面
- `backend`：预约 API、静态页面托管、JSON 本地数据、SQL 初始化脚本

## Requirements

- Node.js 18+

## Quick start

```bash
cd backend
npm start
```

Windows PowerShell 如果拦截 `npm.ps1`，使用：

```powershell
cd backend
npm.cmd start
```

访问地址：

```text
http://127.0.0.1:3000
```

## Scripts

```bash
npm run dev:api
npm run smoke
```

PowerShell 下可使用 `npm.cmd run smoke`。

## Implemented MVP scope

- 用户提交旧物回收上门预约
- 回收品类查询
- 预约单列表、状态筛选和关键词搜索
- 运营端更新状态、回收师傅和估价
- 本地 JSON 数据落盘
- SQL 初始化脚本，包含品类、预约单、索引、约束和初始化数据

## Notes

- 后端默认端口为 `3000`。
- 数据文件位于 `backend/data/appointments.json`。
- SQL 脚本位于 `backend/sql/init.sql`。

# 旧物回收上门预约服务平台 - 后端

后端使用 Node.js 内置 `http` 模块提供 API，同时托管 `../frontend` 下的静态页面。

启动方式：

```bash
npm start
```

核心接口：

- `GET /api/categories`：回收品类
- `GET /api/appointments`：预约单列表，支持 `status` 和 `keyword`
- `POST /api/appointments`：提交预约
- `PATCH /api/appointments/:id`：更新预约状态、回收师傅和估价

数据文件在 `data/appointments.json`，SQL 初始化脚本在 `sql/init.sql`。

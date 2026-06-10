const { server } = require("./server");
const fs = require("fs");
const path = require("path");

const PORT = 3100;
const baseUrl = `http://127.0.0.1:${PORT}`;
const dataFile = path.join(__dirname, "data", "appointments.json");
const dataSnapshot = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, "utf8") : null;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || `HTTP ${response.status}`);
  }
  return body.data || body;
}

async function run() {
  await new Promise(resolve => server.listen(PORT, "127.0.0.1", resolve));

  const health = await request("/api/health");
  if (health.status !== "ok") {
    throw new Error("健康检查失败");
  }

  const created = await request("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      customerName: "测试用户",
      phone: "13700003333",
      address: "测试路 1 号",
      category: "digital",
      itemDescription: "旧笔记本电脑一台",
      preferredDate: "2026-06-15",
      preferredTime: "14:00-18:00",
      note: "测试预约"
    })
  });

  const updated = await request(`/api/appointments/${created.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "completed",
      recyclerName: "测试师傅",
      estimatedAmount: 88
    })
  });

  if (updated.status !== "completed" || updated.recyclerName !== "测试师傅") {
    throw new Error("状态更新失败");
  }

  const appointments = await request("/api/appointments?keyword=测试用户");
  if (!appointments.some(item => item.id === created.id)) {
    throw new Error("预约查询失败");
  }

  console.log(`smoke ok: ${created.id}`);
}

run()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.close();
    if (dataSnapshot !== null) {
      fs.writeFileSync(dataFile, dataSnapshot);
    }
  });

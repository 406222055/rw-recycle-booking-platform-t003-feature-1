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
    const error = new Error(body.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
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

  const pendingAppt = await request("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      customerName: "改期测试用户",
      phone: "13700004444",
      address: "改期路 8 号",
      category: "furniture",
      itemDescription: "旧沙发一套",
      preferredDate: "2026-06-18",
      preferredTime: "09:00-12:00"
    })
  });

  const rescheduled = await request(`/api/appointments/${pendingAppt.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      preferredDate: "2026-06-25",
      preferredTime: "18:00-20:00",
      rescheduleReason: "客户出差，改期到下周晚间"
    })
  });

  if (rescheduled.preferredDate !== "2026-06-25") {
    throw new Error("改期后预约日期未更新");
  }
  if (rescheduled.preferredTime !== "18:00-20:00") {
    throw new Error("改期后预约时段未更新");
  }
  if (rescheduled.rescheduleReason !== "客户出差，改期到下周晚间") {
    throw new Error("改期原因未保存");
  }

  const listAfterReschedule = await request("/api/appointments?keyword=改期测试用户");
  const listItem = listAfterReschedule.find(item => item.id === pendingAppt.id);
  if (!listItem) {
    throw new Error("列表查询未找到改期后的预约");
  }
  if (listItem.preferredDate !== "2026-06-25" || listItem.preferredTime !== "18:00-20:00") {
    throw new Error("列表返回的日期或时段与改期后不一致");
  }

  let missingReasonError = null;
  try {
    await request(`/api/appointments/${pendingAppt.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        preferredDate: "2026-06-30",
        preferredTime: "14:00-18:00"
      })
    });
  } catch (error) {
    missingReasonError = error;
  }
  if (!missingReasonError) {
    throw new Error("缺少改期原因未返回错误");
  }
  if (missingReasonError.status !== 400) {
    throw new Error(`缺少改期原因应返回 400，实际返回 ${missingReasonError.status}`);
  }

  const completedAppt = await request("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      customerName: "已完成用户",
      phone: "13700005555",
      address: "完成路 2 号",
      category: "metal",
      itemDescription: "废纸箱若干",
      preferredDate: "2026-06-10",
      preferredTime: "09:00-12:00"
    })
  });

  await request(`/api/appointments/${completedAppt.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "completed",
      recyclerName: "李师傅",
      estimatedAmount: 30
    })
  });

  let completedRescheduleError = null;
  try {
    await request(`/api/appointments/${completedAppt.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        preferredDate: "2026-07-01",
        preferredTime: "09:00-12:00",
        rescheduleReason: "测试已完成改期"
      })
    });
  } catch (error) {
    completedRescheduleError = error;
  }
  if (!completedRescheduleError) {
    throw new Error("已完成预约改期未返回错误");
  }
  if (completedRescheduleError.status !== 400) {
    throw new Error(`已完成预约改期应返回 400，实际返回 ${completedRescheduleError.status}`);
  }

  const cancelledAppt = await request("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      customerName: "已取消用户",
      phone: "13700006666",
      address: "取消路 3 号",
      category: "appliance",
      itemDescription: "旧电视一台",
      preferredDate: "2026-06-11",
      preferredTime: "14:00-18:00"
    })
  });

  await request(`/api/appointments/${cancelledAppt.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "cancelled",
      note: "客户取消预约"
    })
  });

  let cancelledRescheduleError = null;
  try {
    await request(`/api/appointments/${cancelledAppt.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        preferredDate: "2026-07-02",
        preferredTime: "14:00-18:00",
        rescheduleReason: "测试已取消改期"
      })
    });
  } catch (error) {
    cancelledRescheduleError = error;
  }
  if (!cancelledRescheduleError) {
    throw new Error("已取消预约改期未返回错误");
  }
  if (cancelledRescheduleError.status !== 400) {
    throw new Error(`已取消预约改期应返回 400，实际返回 ${cancelledRescheduleError.status}`);
  }

  console.log(`smoke ok: ${created.id}, reschedule: ${pendingAppt.id}`);
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

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = path.join(__dirname, "data", "appointments.json");
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");

const recycleCategories = [
  { id: "appliance", name: "家电", description: "冰箱、洗衣机、空调、电视等大件家电" },
  { id: "furniture", name: "家具", description: "沙发、床垫、柜子、桌椅等旧家具" },
  { id: "digital", name: "数码设备", description: "手机、电脑、显示器、打印机等电子设备" },
  { id: "metal", name: "金属纸品", description: "废铁、铝材、纸箱、书本等可回收物" }
];

const statusMap = {
  pending: "待确认",
  scheduled: "已预约",
  assigned: "已派单",
  completed: "已完成",
  cancelled: "已取消"
};

function ensureDataFile() {
  if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const seed = [
      {
        id: "AP20260610001",
        customerName: "林女士",
        phone: "13800001111",
        address: "浦东新区民生路 1288 号",
        category: "appliance",
        itemDescription: "双门冰箱一台，可正常通电，电梯房",
        preferredDate: "2026-06-12",
        preferredTime: "09:00-12:00",
        status: "assigned",
        recyclerName: "周师傅",
        estimatedAmount: 120,
        note: "师傅已电话确认上门时间",
        createdAt: "2026-06-10T09:10:00.000Z",
        updatedAt: "2026-06-10T10:20:00.000Z"
      },
      {
        id: "AP20260610002",
        customerName: "陈先生",
        phone: "13900002222",
        address: "徐汇区漕溪北路 45 号",
        category: "furniture",
        itemDescription: "三人沙发一套，需要两人搬运",
        preferredDate: "2026-06-13",
        preferredTime: "14:00-18:00",
        status: "pending",
        recyclerName: "",
        estimatedAmount: 0,
        note: "",
        createdAt: "2026-06-10T11:02:00.000Z",
        updatedAt: "2026-06-10T11:02:00.000Z"
      }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  }
}

function readAppointments() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeAppointments(appointments) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(appointments, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message, details = []) {
  sendJson(res, statusCode, { message, details });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("请求内容过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("JSON 格式不正确"));
      }
    });
    req.on("error", reject);
  });
}

function createId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = String(now.getTime()).slice(-5);
  return `AP${datePart}${suffix}`;
}

function validateAppointment(payload) {
  const errors = [];
  const requiredFields = [
    ["customerName", "联系人"],
    ["phone", "联系电话"],
    ["address", "上门地址"],
    ["category", "回收品类"],
    ["itemDescription", "物品说明"],
    ["preferredDate", "预约日期"],
    ["preferredTime", "预约时段"]
  ];

  requiredFields.forEach(([field, label]) => {
    if (!String(payload[field] || "").trim()) {
      errors.push(`${label}不能为空`);
    }
  });

  if (payload.phone && !/^1[3-9]\d{9}$/.test(String(payload.phone).trim())) {
    errors.push("联系电话必须是 11 位大陆手机号");
  }

  if (payload.category && !recycleCategories.some(item => item.id === payload.category)) {
    errors.push("回收品类不存在");
  }

  return errors;
}

function normalizeAppointment(payload) {
  const now = new Date().toISOString();
  return {
    id: createId(),
    customerName: String(payload.customerName).trim(),
    phone: String(payload.phone).trim(),
    address: String(payload.address).trim(),
    category: String(payload.category).trim(),
    itemDescription: String(payload.itemDescription).trim(),
    preferredDate: String(payload.preferredDate).trim(),
    preferredTime: String(payload.preferredTime).trim(),
    status: "pending",
    recyclerName: "",
    estimatedAmount: 0,
    note: String(payload.note || "").trim(),
    createdAt: now,
    updatedAt: now
  };
}

function enrichAppointment(appointment) {
  const category = recycleCategories.find(item => item.id === appointment.category);
  return {
    ...appointment,
    categoryName: category ? category.name : appointment.category,
    statusName: statusMap[appointment.status] || appointment.status
  };
}

function filterAppointments(appointments, searchParams) {
  const status = searchParams.get("status");
  const keyword = String(searchParams.get("keyword") || "").trim().toLowerCase();

  return appointments.filter(appointment => {
    const statusMatched = !status || status === "all" || appointment.status === status;
    const keywordMatched =
      !keyword ||
      appointment.customerName.toLowerCase().includes(keyword) ||
      appointment.phone.includes(keyword) ||
      appointment.address.toLowerCase().includes(keyword) ||
      appointment.itemDescription.toLowerCase().includes(keyword);
    return statusMatched && keywordMatched;
  });
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (url.pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (url.pathname === "/api/categories" && req.method === "GET") {
    sendJson(res, 200, { data: recycleCategories });
    return;
  }

  if (url.pathname === "/api/appointments" && req.method === "GET") {
    const appointments = filterAppointments(readAppointments(), url.searchParams)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(enrichAppointment);
    sendJson(res, 200, { data: appointments });
    return;
  }

  if (url.pathname === "/api/appointments" && req.method === "POST") {
    const payload = await readBody(req);
    const errors = validateAppointment(payload);
    if (errors.length > 0) {
      sendError(res, 400, "预约信息未填写完整", errors);
      return;
    }

    const appointments = readAppointments();
    const appointment = normalizeAppointment(payload);
    appointments.push(appointment);
    writeAppointments(appointments);
    sendJson(res, 201, { data: enrichAppointment(appointment) });
    return;
  }

  const appointmentMatch = url.pathname.match(/^\/api\/appointments\/([^/]+)$/);
  if (appointmentMatch && req.method === "PATCH") {
    const id = decodeURIComponent(appointmentMatch[1]);
    const payload = await readBody(req);
    const appointments = readAppointments();
    const index = appointments.findIndex(item => item.id === id);

    if (index === -1) {
      sendError(res, 404, "预约单不存在");
      return;
    }

    const nextStatus = String(payload.status || appointments[index].status).trim();
    if (!statusMap[nextStatus]) {
      sendError(res, 400, "预约状态不正确");
      return;
    }

    const validTimeSlots = ["09:00-12:00", "14:00-18:00", "18:00-20:00"];
    const isRescheduling = payload.preferredDate !== undefined || payload.preferredTime !== undefined;
    if (isRescheduling && (appointments[index].status === "completed" || appointments[index].status === "cancelled")) {
      sendError(res, 400, "已完成或已取消的预约不能改期");
      return;
    }

    const nextPreferredDate = payload.preferredDate !== undefined
      ? String(payload.preferredDate).trim()
      : appointments[index].preferredDate;
    const nextPreferredTime = payload.preferredTime !== undefined
      ? String(payload.preferredTime).trim()
      : appointments[index].preferredTime;

    if (payload.preferredDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(nextPreferredDate)) {
      sendError(res, 400, "预约日期格式不正确");
      return;
    }
    if (payload.preferredTime !== undefined && !validTimeSlots.includes(nextPreferredTime)) {
      sendError(res, 400, "预约时段不正确");
      return;
    }
    if (isRescheduling) {
      const reason = String(payload.rescheduleReason || "").trim();
      if (!reason) {
        sendError(res, 400, "请填写改期原因");
        return;
      }
    }

    appointments[index] = {
      ...appointments[index],
      status: nextStatus,
      recyclerName: String(payload.recyclerName ?? appointments[index].recyclerName ?? "").trim(),
      estimatedAmount: Number(payload.estimatedAmount ?? appointments[index].estimatedAmount ?? 0),
      preferredDate: nextPreferredDate,
      preferredTime: nextPreferredTime,
      rescheduleReason: payload.rescheduleReason !== undefined
        ? String(payload.rescheduleReason).trim()
        : (appointments[index].rescheduleReason || ""),
      note: String(payload.note ?? appointments[index].note ?? "").trim(),
      updatedAt: new Date().toISOString()
    };

    writeAppointments(appointments);
    sendJson(res, 200, { data: enrichAppointment(appointments[index]) });
    return;
  }

  sendError(res, 404, "接口不存在");
}

function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(FRONTEND_DIR, requestedPath));

  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("页面不存在");
      return;
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8"
    };
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

ensureDataFile();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    sendError(res, 500, error.message || "服务异常");
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`旧物回收预约平台已启动：http://localhost:${PORT}`);
  });
}

module.exports = { server };

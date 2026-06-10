const api = {
  categories: "/api/categories",
  appointments: "/api/appointments"
};

const statusOptions = [
  ["pending", "待确认"],
  ["scheduled", "已预约"],
  ["assigned", "已派单"],
  ["completed", "已完成"],
  ["cancelled", "已取消"]
];

const bookingForm = document.querySelector("#bookingForm");
const categorySelect = document.querySelector("#categorySelect");
const appointmentList = document.querySelector("#appointmentList");
const statusFilter = document.querySelector("#statusFilter");
const keywordInput = document.querySelector("#keywordInput");
const formMessage = document.querySelector("#formMessage");
const summaryTotal = document.querySelector("#summaryTotal");
const rescheduleModal = document.querySelector("#rescheduleModal");
const rescheduleForm = document.querySelector("#rescheduleForm");
const rescheduleInfo = document.querySelector("#rescheduleInfo");
const rescheduleMessage = document.querySelector("#rescheduleMessage");

const RESCHEDULEABLE_STATUSES = ["pending", "scheduled", "assigned"];

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const result = await response.json();
  if (!response.ok) {
    const details = Array.isArray(result.details) ? result.details.join("；") : "";
    throw new Error(details || result.message || "请求失败");
  }
  return result.data;
}

async function loadCategories() {
  const categories = await request(api.categories);
  categorySelect.innerHTML = categories
    .map(category => `<option value="${category.id}">${category.name} - ${category.description}</option>`)
    .join("");
}

function getAppointmentUrl() {
  const params = new URLSearchParams();
  params.set("status", statusFilter.value);
  if (keywordInput.value.trim()) {
    params.set("keyword", keywordInput.value.trim());
  }
  return `${api.appointments}?${params.toString()}`;
}

async function loadAppointments() {
  const appointments = await request(getAppointmentUrl());
  summaryTotal.textContent = `${appointments.length} 单`;

  if (appointments.length === 0) {
    appointmentList.innerHTML = '<div class="empty">暂无符合条件的预约单</div>';
    return;
  }

  appointmentList.innerHTML = appointments.map(renderAppointment).join("");
}

function renderAppointment(item) {
  const statusClass = item.status === "pending" || item.status === "completed" || item.status === "cancelled"
    ? item.status
    : "";
  const amount = Number(item.estimatedAmount || 0);
  const canReschedule = RESCHEDULEABLE_STATUSES.includes(item.status);

  return `
    <article class="appointment-card" data-id="${item.id}">
      <div class="card-top">
        <div>
          <h3>${item.customerName} · ${item.categoryName}</h3>
          <p>${item.itemDescription}</p>
        </div>
        <span class="badge ${statusClass}">${item.statusName}</span>
      </div>
      <div class="meta">
        <p><strong>联系信息</strong>${item.phone}<br>${item.address}</p>
        <p><strong>预约时间</strong>${item.preferredDate}<br>${item.preferredTime}</p>
        <p><strong>处理信息</strong>${item.recyclerName || "未派单"}<br>估价 ${amount.toFixed(2)} 元</p>
      </div>
      <div class="card-actions">
        <select data-role="status">
          ${statusOptions.map(([value, label]) => `<option value="${value}" ${item.status === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <input data-role="recyclerName" value="${item.recyclerName || ""}" placeholder="回收师傅">
        <input data-role="estimatedAmount" type="number" min="0" step="1" value="${amount}" placeholder="估价">
        <button type="button" data-role="save">保存</button>
        ${canReschedule ? `<button type="button" class="btn-reschedule" data-role="reschedule" data-id="${item.id}">改期</button>` : ""}
      </div>
      ${item.note ? `<p class="message">${item.note}</p>` : ""}
      ${item.rescheduleReason ? `<p class="message"><strong>改期原因：</strong>${item.rescheduleReason}</p>` : ""}
    </article>
  `;
}

function openRescheduleModal(item) {
  const today = new Date().toISOString().slice(0, 10);
  rescheduleForm.elements.appointmentId.value = item.id;
  rescheduleForm.elements.preferredDate.min = today;
  rescheduleForm.elements.preferredDate.value = item.preferredDate;
  rescheduleForm.elements.preferredTime.value = item.preferredTime;
  rescheduleForm.elements.rescheduleReason.value = "";
  rescheduleInfo.innerHTML = `<strong>${item.customerName}</strong> · ${item.categoryName}<br>当前预约：${item.preferredDate} ${item.preferredTime}`;
  rescheduleMessage.textContent = "";
  rescheduleMessage.classList.remove("error");
  rescheduleModal.classList.remove("hidden");
  rescheduleModal.setAttribute("aria-hidden", "false");
}

function closeRescheduleModal() {
  rescheduleModal.classList.add("hidden");
  rescheduleModal.setAttribute("aria-hidden", "true");
}

function showRescheduleMessage(text, isError = false) {
  rescheduleMessage.textContent = text;
  rescheduleMessage.classList.toggle("error", isError);
}

function showFormMessage(text, isError = false) {
  formMessage.textContent = text;
  formMessage.classList.toggle("error", isError);
}

bookingForm.addEventListener("submit", async event => {
  event.preventDefault();
  showFormMessage("正在提交...");

  const payload = Object.fromEntries(new FormData(bookingForm).entries());
  try {
    await request(api.appointments, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    bookingForm.reset();
    showFormMessage("预约已提交，平台会尽快确认。");
    await loadAppointments();
  } catch (error) {
    showFormMessage(error.message, true);
  }
});

appointmentList.addEventListener("click", async event => {
  const saveButton = event.target.closest('[data-role="save"]');
  const rescheduleButton = event.target.closest('[data-role="reschedule"]');

  if (rescheduleButton) {
    const id = rescheduleButton.dataset.id;
    const appointments = await request(getAppointmentUrl());
    const item = appointments.find(a => a.id === id);
    if (item) {
      openRescheduleModal(item);
    }
    return;
  }

  if (!saveButton) {
    return;
  }

  const card = saveButton.closest(".appointment-card");
  const id = card.dataset.id;
  const payload = {
    status: card.querySelector('[data-role="status"]').value,
    recyclerName: card.querySelector('[data-role="recyclerName"]').value,
    estimatedAmount: card.querySelector('[data-role="estimatedAmount"]').value
  };

  saveButton.disabled = true;
  saveButton.textContent = "保存中";

  try {
    await request(`${api.appointments}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    await loadAppointments();
  } catch (error) {
    alert(error.message);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "保存";
  }
});

rescheduleModal.addEventListener("click", event => {
  if (event.target.closest('[data-role="closeModal"]')) {
    closeRescheduleModal();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !rescheduleModal.classList.contains("hidden")) {
    closeRescheduleModal();
  }
});

rescheduleForm.addEventListener("submit", async event => {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(rescheduleForm).entries());
  const id = formData.appointmentId;
  const submitButton = rescheduleForm.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  submitButton.textContent = "提交中";
  showRescheduleMessage("正在改期...");

  try {
    await request(`${api.appointments}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        rescheduleReason: formData.rescheduleReason
      })
    });
    closeRescheduleModal();
    await loadAppointments();
  } catch (error) {
    showRescheduleMessage(error.message, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "确认改期";
  }
});

statusFilter.addEventListener("change", loadAppointments);
keywordInput.addEventListener("input", () => {
  window.clearTimeout(keywordInput.searchTimer);
  keywordInput.searchTimer = window.setTimeout(loadAppointments, 250);
});

async function bootstrap() {
  const today = new Date().toISOString().slice(0, 10);
  bookingForm.elements.preferredDate.min = today;
  bookingForm.elements.preferredDate.value = today;
  await loadCategories();
  await loadAppointments();
}

bootstrap().catch(error => {
  appointmentList.innerHTML = `<div class="empty">${error.message}</div>`;
});

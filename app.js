const state = {
  activeRiskId: dashboardData.risks[0].id,
  activeAlertIndex: 0,
  activeAlertPage: 1,
  alertPageSize: 10,
  trendRange: "today",
  riskTrendRange: "today",
  majorRiskFilter: false,
};

const $ = (selector) => document.querySelector(selector);
const videoBlobCache = new Map();
let videoCacheStarted = false;
const HIGH_RISK_SHARE_THRESHOLD = 26;

function getLevel(score) {
  if (score >= 50) return { name: "高", className: "high" };
  if (score >= 30) return { name: "中", className: "medium" };
  return { name: "低", className: "low" };
}

function activeRisk() {
  return dashboardData.risks.find((risk) => risk.id === state.activeRiskId);
}

function riskTypeName(riskId = state.activeRiskId) {
  return dashboardData.risks.find((risk) => risk.id === riskId)?.name || "";
}

function riskSegmentForStation(station, riskId = state.activeRiskId) {
  const name = riskTypeName(riskId);
  return station?.segments.find((segment) => segment.name === name);
}

function riskIdByName(name) {
  return dashboardData.risks.find((risk) => risk.name === name)?.id;
}

function riskDescription(riskId) {
  return {
    construction: "外部施工靠近管线红线形成的破坏风险",
    strain: "管道受力、沉降或形变异常风险",
    cathodic: "阴保电位异常导致腐蚀防护不足风险",
    leak: "阀井或管段气体浓度异常泄漏风险",
    pressure: "运行压力超限或波动异常风险",
  }[riskId] || "当前风险类型的监测告警";
}

function stationRiskCount(station, riskId = state.activeRiskId) {
  const segment = riskSegmentForStation(station, riskId);
  return Math.max(0, Math.round((station.total * (segment?.value || 0)) / 100));
}

function majorRiskStationsForRisk(riskId) {
  const name = riskTypeName(riskId);
  return dashboardData.stationRiskRatios
    .map((station) => {
      const segment = station.segments.find((item) => item.name === name);
      if (!segment || segment.value < HIGH_RISK_SHARE_THRESHOLD) return null;
      return {
        name: station.station,
        count: Math.max(1, Math.round((station.total * segment.value) / 100)),
        percent: segment.value,
      };
    })
    .filter(Boolean);
}

function majorRiskTotalForRisk(riskId) {
  return majorRiskStationsForRisk(riskId).reduce((sum, station) => sum + station.count, 0);
}

function realConstructionAlertRows() {
  return [
    {
      title: "周边施工低风险视频预警",
      time: "2026-05-30 17:42:16",
      station: "凉风垭储配站",
      region: "重庆/垫江/鼎发燃气",
      camera: "01#监控",
      deviceName: "垫江县桂西路01#监控",
      distance: "62m低风险区",
      level: "低风险",
      beforeAfter: "前后30s视频",
      frequency: { low: 1, medium: 0, high: 0, critical: 0 },
      cause: "视频识别到施工人员或设备处于低风险关注区，暂未进入管道红线或管控区。",
      impact: "当前对管道安全影响较低，但需持续关注后续是否出现机械靠近或开挖行为。",
      advice: "点击查看视频大图，保留视频证据并持续跟踪该点位施工动态。",
      metrics: [
        { label: "施工活动", value: "人员通行", state: "低风险关注" },
        { label: "距管道中心线", value: "62 m", state: "低风险区" },
        { label: "持续时间", value: "短时出现", state: "持续观察" },
      ],
      thumbnail: "",
      videoUrl: "./assets/videos/third-party-construction-low-risk.mp4",
    },
    {
      title: "周边施工低风险视频预警",
      time: "2026-05-30 17:39:08",
      station: "垫江工业园区配气站",
      region: "重庆/垫江/鼎发燃气",
      camera: "02#监控",
      deviceName: "垫江县工业园区迎宾路02#监控",
      distance: "58m低风险区",
      level: "低风险",
      beforeAfter: "前后30s视频",
      frequency: { low: 1, medium: 0, high: 0, critical: 0 },
      cause: "视频识别到施工活动处于低风险关注范围，暂未发现机械越界或开挖动作。",
      impact: "当前风险较低，但施工活动可能随时间向管控区靠近，需要保持视频跟踪。",
      advice: "点击查看视频大图，持续抽帧观察并在出现机械靠近时自动升级预警。",
      metrics: [
        { label: "施工活动", value: "场地整理", state: "低风险关注" },
        { label: "距管道中心线", value: "58 m", state: "低风险区" },
        { label: "持续时间", value: "短时出现", state: "持续观察" },
      ],
      thumbnail: "",
      videoUrl: "./assets/videos/third-party-construction-low-risk-2.mp4",
    },
  ];
}

function riskListCount(riskId) {
  if (state.majorRiskFilter && riskId === state.activeRiskId) return majorRiskTotalForRisk(riskId);
  return dashboardData.typeRatios.find((item) => riskIdByName(item.name) === riskId)?.count || 0;
}

function resetAlertSelection() {
  state.activeAlertIndex = 0;
  state.activeAlertPage = 1;
}

function currentPageSize(pageSize = state.alertPageSize) {
  return pageSize;
}

function pagedAlertRows(rows, pageSize = state.alertPageSize) {
  const size = currentPageSize(pageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  state.activeAlertPage = Math.min(Math.max(1, state.activeAlertPage), pageCount);
  if (state.activeAlertIndex >= rows.length) state.activeAlertIndex = 0;
  const start = (state.activeAlertPage - 1) * size;
  return {
    pageRows: rows.slice(start, start + size),
    start,
    pageCount,
  };
}

function renderTablePager(rows, pageSize = state.alertPageSize) {
  const size = currentPageSize(pageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const start = rows.length ? (state.activeAlertPage - 1) * size + 1 : 0;
  const end = Math.min(rows.length, state.activeAlertPage * size);
  return `
    <div class="table-pager" aria-label="实时告警分页">
      <span>${start}-${end} / ${rows.length}条</span>
      <button type="button" data-page-action="prev" ${state.activeAlertPage <= 1 ? "disabled" : ""}>上一页</button>
      <em>${state.activeAlertPage} / ${pageCount}</em>
      <button type="button" data-page-action="next" ${state.activeAlertPage >= pageCount ? "disabled" : ""}>下一页</button>
    </div>
  `;
}

function bindTablePager(rows, pageSize = state.alertPageSize) {
  document.querySelectorAll(".table-pager button").forEach((button) => {
    button.addEventListener("click", () => {
      const size = currentPageSize(pageSize);
      const pageCount = Math.max(1, Math.ceil(rows.length / size));
      state.activeAlertPage += button.dataset.pageAction === "next" ? 1 : -1;
      state.activeAlertPage = Math.min(Math.max(1, state.activeAlertPage), pageCount);
      state.activeAlertIndex = (state.activeAlertPage - 1) * size;
      renderRealtimeAlerts();
      renderSelectedAnalysis();
    });
  });
}

function openVideoModal(item) {
  if (!item.videoUrl) return;
  const modal = $("#videoModal");
  const player = $("#videoModalPlayer");
  $("#videoModalTitle").textContent = item.title;
  player.src = videoBlobCache.get(item.videoUrl) || item.videoUrl;
  player.load();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  player.play().catch(() => {});
}

function closeVideoModal() {
  const modal = $("#videoModal");
  const player = $("#videoModalPlayer");
  if (!modal || !player) return;
  player.pause();
  player.removeAttribute("src");
  player.load();
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function warmVideoCache() {
  if (videoCacheStarted) return;
  videoCacheStarted = true;
  realConstructionAlertRows()
    .filter((item) => item.videoUrl)
    .forEach((item) => {
      fetch(item.videoUrl)
        .then((response) => response.blob())
        .then((blob) => {
          videoBlobCache.set(item.videoUrl, URL.createObjectURL(blob));
        })
        .catch(() => {});
    });
}

function renderUpdatedAt() {
  $("#updatedAt").textContent = `更新时间 ${dashboardData.updatedAt}`;
}

function renderRiskLevelLegend() {
  const colorNames = {
    低风险: "蓝色",
    中风险: "黄色",
    高风险: "橙色",
  };

  $("#riskLevelLegend").innerHTML = dashboardData.riskLevels
    .map(
      (item) => `
        <span>
          <i style="background:${item.color}; box-shadow:0 0 12px ${item.color}88"></i>
          ${item.level}-${colorNames[item.level]}
        </span>
      `,
    )
    .join("");
}

function enterpriseLevelMeta(level) {
  const meta = {
    蓝色: { label: "蓝色", color: "#38bdf8", className: "blue" },
    黄色: { label: "黄色", color: "#facc15", className: "yellow" },
    橙色: { label: "橙色", color: "#fb923c", className: "orange" },
    红色: { label: "红色", color: "#fb5a70", className: "red" },
  };
  return meta[level] || meta["蓝色"];
}

function formatAmount(value) {
  return Math.round(value).toLocaleString("zh-CN");
}

function enterpriseRiskName(item) {
  if (item.warningType === "疑似停产预警") return "疑似停产";
  if (item.warningType === "用气下降 + 回款下降复合预警") return "疑似减产";
  if (item.warningType === "回款异常预警") return "回款异常";
  if (item.warningType === "经营波动异常预警") return "经营波动";
  return "正常监测";
}

function enterpriseReport(item) {
  if (item.warningType === "疑似停产预警") {
    return `【疑似停产预警】${item.company}已连续${item.zeroGasDays}天燃气用量为0或接近0，明显低于历史正常用气水平。系统判断存在停产、停业、表计异常或数据缺失可能，建议优先核查。`;
  }

  if (item.warningType === "回款异常预警") {
    return `【回款异常预警】${item.company}本期应收金额${formatAmount(item.receivable)}元，实收金额${formatAmount(item.received)}元，回款率为${item.collectionRate}%，低于预警阈值。建议关注企业缴费和经营压力情况。`;
  }

  if (item.warningType === "用气下降 + 回款下降复合预警") {
    return `【疑似减产预警】${item.company}近7日平均燃气用量为${formatAmount(item.weekAverage)}，较近30日基线下降${item.declineRate}%，已连续${item.abnormalDays}天低于正常水平。同期回款率为${item.collectionRate}%，系统判断该企业存在减产或经营波动可能，建议进一步核实生产经营状态。`;
  }

  if (item.warningType === "经营波动异常预警") {
    return `【疑似减产预警】${item.company}近7日平均燃气用量为${formatAmount(item.weekAverage)}，较近30日基线下降${item.declineRate}%，近7日用气波动率高于近30日基线。系统判断该企业存在减产或经营波动可能，建议进一步核实生产经营状态。`;
  }

  return `【常态监测】${item.company}近7日平均燃气用量为${formatAmount(item.weekAverage)}，回款率为${item.collectionRate}%，当前用气与缴费状态处于正常监测范围。`;
}

function elderlyLevelMeta(level) {
  const meta = {
    红色: { color: "#fb5a70", className: "red" },
    橙色: { color: "#fb923c", className: "orange" },
    黄色: { color: "#facc15", className: "yellow" },
  };
  return meta[level] || meta["黄色"];
}

function elderlyReport(item) {
  return `${item.name}，${item.address}，${item.age}岁，${item.reason}。${item.analysis}`;
}

function renderElderlyMonitorPanel() {
  const elderlyItems = dashboardData.elderlyMonitoring;
  const riskSummaries = [
    { name: "长期未用气", level: "红色", rule: "连续3天用气量 = 0" },
    { name: "长期低程度用气", level: "红色", rule: "连续3天用气量低于日常均值10%" },
    { name: "用气骤降", level: "橙色", rule: "近24小时或近3日低于30日均值30%" },
    { name: "用气异常升高", level: "黄色", rule: "近24小时高于30日均值200%" },
  ].map((summary) => ({
    ...summary,
    count: elderlyItems.filter((item) => item.riskName === summary.name).length,
    ...elderlyLevelMeta(summary.level),
  }));

  $("#elderlyMonitorContent").innerHTML = `
    <div class="elderly-risk-grid">
      ${riskSummaries
        .map(
          (item) => `
            <article class="elderly-risk-card ${item.className}">
              <span>${item.name}</span>
              <strong>${item.count}</strong>
              <small>${item.rule}</small>
            </article>
          `,
        )
        .join("")}
    </div>
    <h3 class="elderly-analysis-title">分析结果</h3>
    <div class="elderly-analysis-list">
      ${elderlyItems
        .map((item) => {
          const level = elderlyLevelMeta(item.level);
          return `
            <article class="elderly-analysis-item ${level.className}">
              <div>
                <strong>${item.name} · ${item.age}岁</strong>
                <span>${item.riskName} · ${item.level}</span>
              </div>
              <p>${elderlyReport(item)}</p>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderEnterpriseRiskPanel() {
  const enterprises = dashboardData.enterpriseMonitoring;
  const levelOrder = ["红色", "橙色", "黄色", "蓝色"];
  const riskSummary = [
    { name: "疑似停产", level: "红色" },
    { name: "疑似减产", level: "橙色" },
    { name: "回款异常", level: "黄色" },
    { name: "经营波动", level: "黄色" },
  ].map((summary) => ({
    ...summary,
    count: enterprises.filter((item) => enterpriseRiskName(item) === summary.name).length,
    ...enterpriseLevelMeta(summary.level),
  }));
  const focused = enterprises
    .filter((item) => item.warningType !== "正常监测")
    .sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));

  $("#enterpriseRiskContent").innerHTML = `
    <h3 class="enterprise-analysis-title">企业经营分析</h3>
    <div class="enterprise-levels">
      ${riskSummary
        .map(
          (item) => `
            <article class="enterprise-level ${item.className}">
              <span>${item.name}</span>
              <strong>${item.count}</strong>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="enterprise-risk-list">
      ${focused
        .map((item) => {
          const level = enterpriseLevelMeta(item.level);
          return `
            <article class="enterprise-risk-item ${level.className}">
              <div>
                <strong>${item.company}</strong>
                <span>${enterpriseRiskName(item)} · ${item.level}</span>
              </div>
              <p>${enterpriseReport(item)}</p>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderMajorRiskPanel() {
  const majorRisks = dashboardData.typeRatios.map((riskType) => {
    const stations = majorRiskStationsForRisk(riskIdByName(riskType.name));
    return { ...riskType, stations, count: stations.reduce((sum, item) => sum + item.count, 0) };
  });

  $("#typeRatioBars").innerHTML = `
    <div class="major-risk-board">
      ${majorRisks
        .map((item) => {
          const stationText = item.stations.length
            ? `${item.name}高风险预警已进入集中管控`
            : "暂无高风险预警";
          const isActive = item.count > 0;
          const statusText = isActive ? "需立即关注" : "运行平稳";
          const riskId = riskIdByName(item.name);
          const isSelected = state.majorRiskFilter && state.activeRiskId === riskId;
          return `
            <button class="major-risk-card ${isActive ? "active" : ""} ${isSelected ? "selected" : ""}" type="button" data-risk-id="${riskId}">
              <div class="major-risk-top">
                <span class="danger-mark" style="background:${isActive ? "#fb923c" : "rgba(148, 163, 184, .28)"}">${isActive ? "!" : "✓"}</span>
                <strong>${item.name}</strong>
              </div>
              <div class="major-risk-number">
                <em>${item.count}</em>
                <span>高风险预警</span>
              </div>
              <p>${stationText}</p>
              <small>${statusText}</small>
            </button>
          `;
        })
        .join("")}
    </div>
  `;

  document.querySelectorAll(".major-risk-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.activeRiskId = card.dataset.riskId;
      resetAlertSelection();
      state.majorRiskFilter = true;
      renderAll();
    });
  });
}

function renderRiskList() {
  $("#riskList").innerHTML = dashboardData.risks
    .map((risk) => {
      const level = getLevel(risk.score);
      const displayValue = riskListCount(risk.id);
      const description = riskDescription(risk.id);
      return `
        <button class="risk-card ${risk.id === state.activeRiskId ? "active" : ""}" data-risk-id="${risk.id}">
          <span class="risk-icon">${risk.icon}</span>
          <span class="risk-main">
            <strong>${risk.name}</strong>
            <small title="${description}">${description}</small>
          </span>
          <span class="risk-score ${level.className}">
            ${displayValue}
          </span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll(".risk-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeRiskId = button.dataset.riskId;
      resetAlertSelection();
      state.majorRiskFilter = false;
      renderAll();
    });
  });
}

function activeAlert() {
  const rows = currentAlertRows();
  return rows[state.activeAlertIndex] || rows[0] || null;
}

function currentAlertRows() {
  if (state.activeRiskId === "construction" && !state.majorRiskFilter) {
    return realConstructionAlertRows();
  }
  if (state.majorRiskFilter) return buildMajorControlRows(state.activeRiskId);
  return dashboardData.stationRiskRatios.flatMap((item) => buildStationRows(item, state.activeRiskId));
}

function stationRiskLevel(percent) {
  if (percent >= 26) return "高风险";
  if (percent >= 16) return "中风险";
  return "低风险";
}

function stationFrequency(percent) {
  return {
    low: Math.max(1, Math.round(percent / 12)),
    medium: Math.max(0, Math.round(percent / 18)),
    high: Math.max(0, Math.round(percent / 28)),
    critical: 0,
  };
}

function stationFrequencyByCount(count, level) {
  const frequency = { low: 0, medium: 0, high: 0, critical: 0 };
  const key = {
    低风险: "low",
    中风险: "medium",
    高风险: "high",
  }[level] || "low";
  frequency[key] = count;
  return frequency;
}

function strainLevelByValue(value) {
  const strain = Number.parseFloat(value);
  if (Number.isNaN(strain)) return "正常";
  if (strain >= 500) return "高风险";
  if (strain >= 300) return "中风险";
  if (strain >= 120) return "低风险";
  return "正常";
}

function gasLevelByValue(value) {
  const gas = Number.parseFloat(value);
  if (Number.isNaN(gas)) return "正常";
  if (gas >= 50) return "高风险";
  if (gas >= 20) return "中风险";
  if (gas >= 10) return "低风险";
  return "正常";
}

function pressureLevelByKpa(value) {
  const pressure = Number.parseFloat(value);
  if (Number.isNaN(pressure)) return "正常";
  if (pressure >= 380) return "高风险";
  if (pressure >= 370) return "中风险";
  if (pressure >= 360 || pressure < 300) return "低风险";
  return "正常";
}

function cathodicLevelByOffPotential(value) {
  const potential = Number(value);
  if (Number.isNaN(potential)) return "正常";
  if (potential > -0.75 || potential < -1.3) return "高风险";
  if (potential < -1.2) return "中风险";
  if (potential > -0.85) return "低风险";
  if (potential >= -1.2 && potential <= -0.85) return "正常";
  return "正常";
}

function withCathodicLevel(row) {
  return {
    ...row,
    level: cathodicLevelByOffPotential(row.offPotential, row.sustainedHours),
  };
}

function cathodicMetrics(row) {
  return [
    { label: "断电电位", value: `${row.offPotential} V`, state: row.level || cathodicLevelByOffPotential(row.offPotential) },
    { label: "直流电流密度", value: row.dcDensity, state: "同步监测" },
    { label: "交流电压", value: `${row.acVoltage} V`, state: "同步监测" },
    { label: "阳极输出电流", value: `${row.anodeCurrent} mA`, state: "同步监测" },
  ];
}

function riskThresholdText(riskId, alert) {
  if (riskId === "strain") {
    return `当前应变值：${alert.strain} με；阈值：正常 < 120με，低风险 120με ≤ ε < 300με，中风险 300με ≤ ε < 500με，高风险 ε ≥ 500με；当前判定：${alert.level}`;
  }

  if (riskId === "cathodic") {
    return `当前断电电位：${alert.offPotential} V；阈值：正常 -1.20V ≤ U ≤ -0.85V，低风险 U > -0.85V，中风险 U < -1.20V，高风险 U > -0.75V 或 U < -1.30V；当前判定：${alert.level}；辅助指标：直流电流密度 ${alert.dcDensity}，交流电压 ${alert.acVoltage} V，阳极输出电流 ${alert.anodeCurrent} mA`;
  }

  if (riskId === "leak") {
    return `当前气体浓度：${alert.gas}；阈值：正常 < 10% LEL，低风险 10%-20% LEL，中风险 20%-50% LEL，高风险 ≥ 50% LEL；当前判定：${alert.level}；同步压力：${alert.pressure || "-"}`;
  }

  if (riskId === "pressure") {
    return `当前压力：${alert.pressure} kPa；阈值：正常 300-360kPa，低风险 360-370kPa 或 < 300kPa，中风险 370-380kPa，高风险 ≥ 380kPa；当前判定：${alert.level}`;
  }

  return (alert.metrics || activeRisk().metrics)
    .map((metric) => `${metric.label}：${metric.value}（${metric.state}）`)
    .join("；");
}

function buildMajorControlRows(riskId) {
  const risk = dashboardData.risks.find((item) => item.id === riskId);
  const stations = majorRiskStationsForRisk(riskId);
  const total = majorRiskTotalForRisk(riskId);
  if (!total) return [];
  let sequence = 0;
  return stations.flatMap((stationInfo) =>
    Array.from({ length: stationInfo.count }, () => {
      sequence += 1;
      const minute = String(43 - Math.ceil(sequence / 2)).padStart(2, "0");
      const second = String(60 - ((sequence * 7) % 60)).padStart(2, "0");
      const common = {
        time: `2026-05-30 17:${minute}:${second}`,
        station: stationInfo.name,
        region: "重庆/垫江/鼎发燃气",
        level: "高风险",
        frequency: { low: 0, medium: 0, high: stationInfo.count, critical: 0 },
        cause: `${risk.name}高风险累计${stationInfo.count}件，当前纳入高风险管控筛选，需按设备与风险类型集中核查。`,
        impact: `该风险类型共触发${total}条高风险告警，若未及时处置，可能影响设备安全裕度、管段运行稳定和应急资源调度。`,
        advice: `优先核查相关实时监测值、设备状态和历史处置记录，并将${total}条高风险纳入闭环工单。`,
      };

      if (riskId === "construction") {
        return {
          ...common,
          title: `周边施工高风险预警 ${sequence}`,
          camera: `${String(sequence).padStart(2, "0")}#球机`,
          deviceName: `垫江县桂东路${String(sequence).padStart(2, "0")}#监控`,
          distance: sequence % 2 ? "8m红区" : "10m红区",
          beforeAfter: "前后30s视频",
          thumbnail: dashboardData.constructionVideos[sequence % dashboardData.constructionVideos.length]?.thumbnail || dashboardData.constructionVideos[0].thumbnail,
        };
      }

      if (riskId === "strain") {
        return {
          ...common,
          code: `DF-SS-M${String(sequence).padStart(3, "0")}`,
          type: "管道应力应变监测终端",
          strain: String(520 - sequence * 6),
        };
      }

      if (riskId === "cathodic") {
        const row = {
          ...common,
          station: `${stationInfo.name} CP-${String(sequence).padStart(3, "0")}`,
          offPotential: (-0.62 - (sequence % 3) * 0.015).toFixed(2),
          sustainedHours: 2,
          dcDensity: (18 + sequence * 0.4).toFixed(1),
          acDensity: (4.8 + sequence * 0.1).toFixed(1),
          acVoltage: (8.1 + sequence * 0.2).toFixed(1),
          naturalPotential: "-0.76",
          anodeOpenPotential: "1.24",
          anodeCurrent: String(42 + sequence),
          signal: `${92 - (sequence % 4)}%`,
          battery: (3.62 - (sequence % 3) * 0.01).toFixed(2),
        };
        return { ...row, metrics: cathodicMetrics(row) };
      }

      if (riskId === "leak") {
        return {
          ...common,
          code: `DF-GAS-M${String(sequence).padStart(3, "0")}`,
          type: "物联网阀门井气体报警器",
          pressure: `${380 + (sequence % 4) * 3}kPa`,
          gas: `${52 + (sequence % 5)}%LEL`,
        };
      }

      return {
        ...common,
        code: `DF-PT-M${String(sequence).padStart(3, "0")}`,
        type: "智能远程压力监测终端",
        pressure: String(382 + (sequence % 5) * 2),
      };
    }),
  );
}

function buildStationRows(station, riskId) {
  const risk = dashboardData.risks.find((item) => item.id === riskId);
  const segment = riskSegmentForStation(station, riskId) || { value: 18 };
  const count = stationRiskCount(station, riskId);
  const level = stationRiskLevel(segment.value);
  const frequency = stationFrequencyByCount(count, level);
  const baseCode = station.station.replace(/[（）()]/g, "").slice(0, 2).toUpperCase();
  const common = {
    region: "重庆/垫江/鼎发燃气",
    level,
    frequency,
    cause: `当前设备在${risk.name}维度占比为${segment.value}%，风险贡献高于日常均值，需结合实时监测数据复核。`,
    impact: `若${risk.name}持续升高，可能影响设备运行、周边管段安全裕度和后续处置资源调度。`,
    advice: `建议调度中心优先核查该设备的${risk.name}监测记录，联动属地巡检并对连续异常点位生成处置工单。`,
  };

  if (riskId === "construction") {
    return Array.from({ length: count }, (_, item) => {
      const isDemoVideo = station.station === "凉风垭储配站" && item === 0;
      return {
        ...common,
        title: isDemoVideo ? "周边施工低风险视频预警" : `周边施工视频预警 ${item + 1}`,
        time: `2026-05-30 17:${String(42 - item * 3).padStart(2, "0")}:1${item}`,
        camera: `${String(item + 1).padStart(2, "0")}#枪机`,
        deviceName: isDemoVideo ? "垫江县桂西路01#监控" : `垫江县桂东路${String(item + 1).padStart(2, "0")}#监控`,
        distance: isDemoVideo ? "62m低风险区" : item === 0 ? "10m红区" : item <= 2 ? "26m管控区" : "45m关注区",
        level: isDemoVideo ? "低风险" : common.level,
        frequency: isDemoVideo ? { low: count, medium: 0, high: 0, critical: 0 } : common.frequency,
        cause: isDemoVideo ? "视频识别到施工人员或设备处于低风险关注区，暂未进入管道红线或管控区。" : common.cause,
        impact: isDemoVideo ? "当前对管道安全影响较低，但需持续关注后续是否出现机械靠近或开挖行为。" : common.impact,
        advice: isDemoVideo ? "点击查看视频大图，保留视频证据并持续跟踪该点位施工动态。" : common.advice,
        beforeAfter: "前后30s视频",
        thumbnail: isDemoVideo ? "" : dashboardData.constructionVideos[item % dashboardData.constructionVideos.length]?.thumbnail || dashboardData.constructionVideos[0].thumbnail,
        videoUrl: isDemoVideo ? "./assets/videos/third-party-construction-low-risk.mp4" : "",
      };
    });
  }

  if (riskId === "cathodic") {
    const offPotentials = [-0.66, -0.73, -0.79, -0.83];
    return Array.from({ length: count }, (_, item) => {
      const offPotential = offPotentials[item % offPotentials.length];
      const derivedLevel = cathodicLevelByOffPotential(offPotential);
      const row = {
      ...common,
      level: derivedLevel,
      frequency: stationFrequencyByCount(count, derivedLevel),
      time: `2026-05-30 17:${42 - item}:16`,
      station: `${station.station} CP-${String(17 + item).padStart(3, "0")}`,
      offPotential: offPotential.toFixed(2),
      sustainedHours: 2,
      dcDensity: (10 + segment.value / 2 - item * 0.9).toFixed(1),
      acDensity: (2.1 + segment.value / 20 - item * 0.2).toFixed(1),
      acVoltage: (4.6 + segment.value / 10 - item * 0.3).toFixed(1),
      naturalPotential: (-0.76 - item * 0.03).toFixed(2),
      anodeOpenPotential: (1.12 + item * 0.02).toFixed(2),
      anodeCurrent: String(34 + item * 3),
      signal: `${92 - item * 3}%`,
      battery: (3.62 - item * 0.03).toFixed(2),
      };
      return { ...row, metrics: cathodicMetrics(row) };
    });
  }

  const fieldByRisk = {
    strain: { code: "SS", type: "管道应力应变监测终端", key: "strain", values: ["560", "482", "326", "168"] },
    leak: { code: "GAS", type: "物联网阀门井气体报警器", key: "gas", values: ["55%LEL", "32%LEL", "16%LEL", "8%LEL"], pressureValues: ["382kPa", "376kPa", "365kPa", "330kPa"] },
    pressure: { code: "PT", type: "智能远程压力监测终端", key: "pressure", values: ["385", "376", "365", "295"] },
  }[riskId] || { code: "PT", type: "智能远程压力监测终端", key: "pressure", values: ["365", "330", "320", "310"] };

  return Array.from({ length: count }, (_, item) => {
    const value = fieldByRisk.values[item % fieldByRisk.values.length];
    const derivedLevel = {
      strain: strainLevelByValue(value),
      leak: gasLevelByValue(value),
      pressure: pressureLevelByKpa(value),
    }[riskId] || common.level;
    return {
      ...common,
      level: derivedLevel,
      frequency: stationFrequencyByCount(count, derivedLevel),
      time: `2026-05-30 17:${42 - item}:1${6 - item}`,
      station: station.station,
      code: `DF-${fieldByRisk.code}-${baseCode}${String(item + 1).padStart(3, "0")}`,
      type: fieldByRisk.type,
      pressure: riskId === "leak" ? fieldByRisk.pressureValues[item % fieldByRisk.pressureValues.length] : undefined,
      [fieldByRisk.key]: value,
    };
  });
}

function pressureClass(level) {
  return {
    正常: "pressure-normal",
    低风险: "pressure-low",
    中风险: "pressure-medium",
    高风险: "pressure-high",
  }[level] || "pressure-normal";
}

function deviceId(row, riskId = state.activeRiskId) {
  const prefix = {
    construction: "DF-VI",
    strain: "DF-SS",
    cathodic: "DF-CP",
    leak: "DF-GAS",
    pressure: "DF-PT",
  }[riskId] || "DF-EQ";
  const source = row.code || row.station || row.title || "000";
  const seed = Array.from(source).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 1000;
  return row.deviceId || row.code || `${prefix}-${String(seed).padStart(3, "0")}`;
}

function deviceName(row, riskId = state.activeRiskId) {
  if (riskId === "construction") return row.deviceName || `垫江县桂东路${row.camera || "01#监控"}`;
  const names = {
    strain: "管道应力应变监测终端",
    cathodic: "阴极保护智能采集终端",
    leak: "物联网阀门井气体报警器",
    pressure: "智能远程压力监测终端",
  };
  return row.deviceName || row.type || names[riskId] || "安全监测终端";
}

function areaText(row) {
  return row.area || row.region || "重庆/垫江/鼎发燃气";
}

function sampleFrequency(row, index) {
  return row.sampleFrequency || ["5Hz", "10Hz", "20Hz", "1Hz"][index % 4];
}

function temperatureValue(row, index) {
  return row.temperature || `${(24.6 + (index % 5) * 0.8).toFixed(1)}℃`;
}

function currentValue(base, step, index) {
  return (base + step * index).toFixed(1);
}

function alertRiskStatus(alert, risk = activeRisk()) {
  return `${risk.name} · ${alert?.level || getLevel(risk.score).name + "风险"}`;
}

function analysisDeviceTitle(alert, riskId = state.activeRiskId) {
  return `${deviceId(alert, riskId)} · ${deviceName(alert, riskId)}`;
}

function renderEmptyRealtime(message = "暂无高风险数据") {
  $("#realtimeContent").innerHTML = `
    <div class="empty-state">
      <span>!</span>
      <strong>${message}</strong>
      <p>当前筛选条件下未发现需要处置的高风险告警。</p>
    </div>
  `;
}

function renderRealtimeAlerts() {
  const panelLabel = document.querySelector(".map-panel .chip");
  if (state.activeRiskId === "construction") {
    panelLabel.textContent = "视频预警";
    renderConstructionVideos();
    return;
  }

  if (state.activeRiskId === "cathodic") {
    panelLabel.textContent = "阴保监测";
    renderCathodicTable();
    return;
  }

  if (state.activeRiskId === "strain") {
    panelLabel.textContent = "应变με";
    renderStrainTable();
    return;
  }

  const valueLabels = {
    leak: "可燃气体 LEL",
    pressure: "压力 kPa",
  };
  panelLabel.textContent = valueLabels[state.activeRiskId] || "压力 kPa";
  const valueHeader = state.activeRiskId === "leak" ? "可燃气体浓度（LEL）" : "压力（kpa）";
  const rows = currentAlertRows();
  if (!rows.length) {
    renderEmptyRealtime();
    return;
  }
  const { pageRows, start } = pagedAlertRows(rows);
  $("#realtimeContent").innerHTML = `
    <div class="risk-table-wrap">
      <table class="risk-table">
        <thead>
          <tr>
            <th class="seq-col">序号</th>
            <th>时间</th>
            <th>设备ID</th>
            <th>设备名称</th>
            <th>区域</th>
            <th>温度</th>
            <th>${valueHeader}</th>
          </tr>
        </thead>
        <tbody id="alertTableBody"></tbody>
      </table>
    </div>
    ${renderTablePager(rows)}
  `;

  $("#alertTableBody").innerHTML = pageRows
    .map(
      (row, index) => `
          <tr class="${start + index === state.activeAlertIndex ? "active" : ""}" data-alert-index="${start + index}">
            <td class="seq-col">${start + index + 1}</td>
            <td>${row.time}</td>
            <td>${deviceId(row, state.activeRiskId)}</td>
            <td>${deviceName(row, state.activeRiskId)}</td>
            <td>${areaText(row)}</td>
            <td>${temperatureValue(row, start + index)}</td>
            <td><strong class="${pressureClass(row.level)}">${state.activeRiskId === "leak" ? row.gas || "-" : row.pressure || "-"}</strong></td>
          </tr>
        `,
    )
    .join("");

  document.querySelectorAll("#alertTableBody tr").forEach((row) => {
    row.addEventListener("click", () => {
      state.activeAlertIndex = Number(row.dataset.alertIndex);
      renderRealtimeAlerts();
      renderSelectedAnalysis();
    });
  });
  bindTablePager(rows);
}

function renderStrainTable() {
  const rows = currentAlertRows();
  if (!rows.length) {
    renderEmptyRealtime();
    return;
  }
  const { pageRows, start } = pagedAlertRows(rows);
  $("#realtimeContent").innerHTML = `
    <div class="risk-table-wrap">
      <table class="risk-table">
        <thead>
          <tr>
            <th class="seq-col">序号</th>
            <th>时间</th>
            <th>设备ID</th>
            <th>设备名称</th>
            <th>区域</th>
            <th>频率</th>
            <th>温度</th>
            <th>应变量</th>
          </tr>
        </thead>
        <tbody id="alertTableBody">
          ${pageRows
            .map(
              (row, index) => `
                <tr class="${start + index === state.activeAlertIndex ? "active" : ""}" data-alert-index="${start + index}">
                  <td class="seq-col">${start + index + 1}</td>
                  <td>${row.time}</td>
                  <td>${deviceId(row, "strain")}</td>
                  <td>${deviceName(row, "strain")}</td>
                  <td>${areaText(row)}</td>
                  <td>${sampleFrequency(row, start + index)}</td>
                  <td>${temperatureValue(row, start + index)}</td>
                  <td><strong class="${pressureClass(row.level)}">${row.strain}</strong></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    ${renderTablePager(rows)}
  `;

  document.querySelectorAll("#alertTableBody tr").forEach((row) => {
    row.addEventListener("click", () => {
      state.activeAlertIndex = Number(row.dataset.alertIndex);
      renderStrainTable();
      renderSelectedAnalysis();
    });
  });
  bindTablePager(rows);
}

function renderCathodicTable() {
  const rows = currentAlertRows();
  if (!rows.length) {
    renderEmptyRealtime();
    return;
  }
  const { pageRows, start } = pagedAlertRows(rows);
  $("#realtimeContent").innerHTML = `
    <div class="risk-table-wrap">
      <table class="risk-table cathodic-table">
        <thead>
          <tr>
            <th class="seq-col">序号</th>
            <th>时间</th>
            <th>设备ID</th>
            <th>设备名称</th>
            <th>区域</th>
            <th>通电电位(V)</th>
            <th>断电电位(V)</th>
            <th>直流电流(mA)</th>
            <th>直流电流密度(A/㎡)</th>
            <th>交流电流(mA)</th>
            <th>交流电流密度(A/㎡)</th>
            <th>阳极开路电位(V)</th>
            <th>阳极输出电流(mA)</th>
            <th>信号强度</th>
            <th>电池电压(V)</th>
          </tr>
        </thead>
        <tbody id="alertTableBody">
          ${pageRows
            .map(
              (row, index) => `
                <tr class="${start + index === state.activeAlertIndex ? "active" : ""}" data-alert-index="${start + index}">
                  <td class="seq-col">${start + index + 1}</td>
                  <td>${row.time}</td>
                  <td>${deviceId(row, "cathodic")}</td>
                  <td>${deviceName(row, "cathodic")}</td>
                  <td>${areaText(row)}</td>
                  <td>${row.onPotential || (Number(row.offPotential) - 0.22).toFixed(2)}</td>
                  <td><strong class="${pressureClass(row.level)}">${row.offPotential}</strong></td>
                  <td>${row.dcCurrent || currentValue(72, 4.2, start + index)}</td>
                  <td>${row.dcDensity}</td>
                  <td>${row.acCurrent || currentValue(16, 1.7, start + index)}</td>
                  <td>${row.acDensity}</td>
                  <td>${row.anodeOpenPotential}</td>
                  <td>${row.anodeCurrent}</td>
                  <td>${row.signal}</td>
                  <td>${row.battery}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    ${renderTablePager(rows)}
  `;

  document.querySelectorAll("#alertTableBody tr").forEach((row) => {
    row.addEventListener("click", () => {
      state.activeAlertIndex = Number(row.dataset.alertIndex);
      renderCathodicTable();
      renderSelectedAnalysis();
    });
  });
  bindTablePager(rows);
}

function renderConstructionVideos() {
  const rows = currentAlertRows();
  if (!rows.length) {
    renderEmptyRealtime();
    return;
  }
  const constructionPageSize = 6;
  const { pageRows, start } = pagedAlertRows(rows, constructionPageSize);
  $("#realtimeContent").innerHTML = `
    <div class="video-grid">
      ${pageRows
        .map(
          (item, index) => `
            <article class="video-card ${start + index === state.activeAlertIndex ? "active" : ""}" tabindex="0" role="button" data-alert-index="${start + index}" title="点击选中该风险事件">
              <button class="video-thumb ${item.videoUrl ? "has-video" : ""}" type="button" data-alert-index="${start + index}" aria-label="查看视频大图" style="background:${item.thumbnail}">
                ${item.videoUrl ? `<video src="${item.videoUrl}" muted preload="auto" playsinline></video>` : ""}
                <span class="video-open"><i></i></span>
              </button>
              <strong>${item.title}</strong>
              <small>${item.time} · ${item.camera}</small>
              <em>${item.distance} · ${item.level} · ${item.beforeAfter}</em>
            </article>
          `,
        )
        .join("")}
    </div>
    ${renderTablePager(rows, constructionPageSize)}
  `;

  document.querySelectorAll(".video-card").forEach((card) => {
    const selectCard = () => {
      state.activeAlertIndex = Number(card.dataset.alertIndex);
      renderConstructionVideos();
      renderSelectedAnalysis();
    };

    card.addEventListener("click", selectCard);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectCard();
    });
  });

  document.querySelectorAll(".video-open").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.activeAlertIndex = Number(button.dataset.alertIndex);
      const selectedItem = currentAlertRows()[state.activeAlertIndex];
      renderConstructionVideos();
      renderSelectedAnalysis();
      openVideoModal(selectedItem);
    });
  });
  bindTablePager(rows, constructionPageSize);
}

function renderSelectedAnalysis() {
  const alert = activeAlert();
  const risk = activeRisk();
  if (!alert) {
    $("#selectedAlertLabel").textContent = "暂无数据";
    $("#selectedAnalysis").innerHTML = `
      <article class="model-analysis empty-analysis">
        <div class="analysis-summary">
          <strong>${risk.name}暂无高风险告警</strong>
          <span>高风险筛选</span>
        </div>
        <section>
          <h3>研判结果</h3>
          <p>当前风险类型下未发现高风险实时告警，建议保持常规监测，并持续关注风险管控与趋势变化。</p>
        </section>
      </article>
    `;
    return;
  }
  const frequencyText = `低风险 ${alert.frequency.low} 次，中风险 ${alert.frequency.medium} 次，高风险 ${alert.frequency.high} 次。`;
  const metricText = riskThresholdText(risk.id, alert);

  $("#selectedAlertLabel").textContent = alertRiskStatus(alert, risk);
  $("#selectedAnalysis").innerHTML = `
    <article class="model-analysis">
      <div class="analysis-summary">
        <strong>${analysisDeviceTitle(alert, risk.id)}</strong>
      </div>
      <section>
        <h3>历史告警频次</h3>
        <p>${frequencyText}</p>
      </section>
      <section>
        <h3>可能原因</h3>
        <p>${alert.cause}</p>
      </section>
      <section>
        <h3>可能影响</h3>
        <p>${alert.impact}</p>
      </section>
      <section>
        <h3>处置建议</h3>
        <p>${alert.advice}</p>
      </section>
      <p class="analysis-footnote">${metricText}。</p>
    </article>
  `;
}

function renderTrend() {
  const enterprises = dashboardData.enterpriseMonitoring;
  const totalGas = enterprises.reduce((sum, item) => sum + item.monthGas, 0);
  const totalCollection = enterprises.reduce((sum, item) => sum + item.received, 0);

  $("#enterpriseStatsContent").innerHTML = `
    <div class="enterprise-stat-grid">
      <article class="enterprise-stat-card">
        <span>用气企业数</span>
        <strong>55<small>家</small></strong>
      </article>
      <article class="enterprise-stat-card">
        <span>本月总用气量</span>
        <strong>${formatAmount(totalGas)}<small>m³</small></strong>
      </article>
      <article class="enterprise-stat-card">
        <span>本月总回款</span>
        <strong>${formatAmount(totalCollection)}<small>元</small></strong>
      </article>
    </div>
  `;
}

function renderRiskTrend() {
  const canvas = $("#riskTrendCanvas");
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const riskTypes = dashboardData.typeRatios;
  const rangeNames = { today: "今日", week: "近7天", month: "近30天" };
  const rangeFactor = { today: 1, week: 4.8, month: 15.6 }[state.riskTrendRange] || 1;
  const left = 78;
  const right = 38;
  const top = 60;
  const bottom = 74;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const trendItems = riskTypes.map((riskType) => ({
    ...riskType,
    value: Math.max(1, Math.round(riskType.count * rangeFactor)),
  }));
  const maxValue = Math.max(...trendItems.map((item) => item.value), 5);
  const yMax = Math.ceil(maxValue / 5) * 5;
  const slotWidth = chartWidth / trendItems.length;
  const barWidth = Math.min(76, slotWidth * 0.46);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#07111f";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(148, 163, 184, .18)";
  context.lineWidth = 1;
  context.font = "15px Arial";
  context.textAlign = "right";
  context.fillStyle = "#94a3b8";
  for (let i = 0; i <= 5; i += 1) {
    const value = (yMax / 5) * i;
    const y = top + chartHeight - (value / yMax) * chartHeight;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(width - right, y);
    context.stroke();
    context.fillText(String(Math.round(value)), left - 14, y + 5);
  }

  context.strokeStyle = "rgba(125, 211, 252, .32)";
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left, top + chartHeight);
  context.lineTo(width - right, top + chartHeight);
  context.stroke();

  context.fillStyle = "#94a3b8";
  context.font = "20px Arial";
  context.textAlign = "left";
  context.fillText(`${rangeNames[state.riskTrendRange]}风险次数趋势`, left, 30);

  const points = trendItems.map((item, index) => {
    const x = left + slotWidth * index + slotWidth / 2;
    const y = top + chartHeight - (item.value / yMax) * chartHeight;
    return { ...item, x, y };
  });

  points.forEach((item) => {
    const barHeight = top + chartHeight - item.y;
    const gradient = context.createLinearGradient(0, item.y, 0, top + chartHeight);
    gradient.addColorStop(0, item.color);
    gradient.addColorStop(1, `${item.color}33`);
    context.fillStyle = gradient;
    context.shadowColor = item.color;
    context.shadowBlur = 14;
    context.fillRect(item.x - barWidth / 2, item.y, barWidth, barHeight);
    context.shadowBlur = 0;

    context.fillStyle = "#f8fafc";
    context.font = "700 22px Arial";
    context.textAlign = "center";
    context.fillText(String(item.value), item.x, item.y - 10);

    context.fillStyle = "#cbd5e1";
    context.font = "700 17px Arial";
    context.fillText(item.name, item.x, height - 42);
  });

  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = "rgba(226, 232, 240, .86)";
  context.lineWidth = 2;
  context.shadowColor = "rgba(34, 211, 238, .55)";
  context.shadowBlur = 10;
  context.stroke();
  context.shadowBlur = 0;

  points.forEach((point) => {
    context.beginPath();
    context.arc(point.x, point.y, 5, 0, Math.PI * 2);
    context.fillStyle = "#07111f";
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = point.color;
    context.stroke();
  });

  context.textAlign = "left";
  context.fillStyle = "#93a4b8";
  context.font = "15px Arial";
  context.fillText("横坐标：五大风险  /  纵坐标：告警次数", left, height - 12);
  $("#riskTrendLabel").textContent = rangeNames[state.riskTrendRange];
}

function renderAll() {
  renderUpdatedAt();
  renderRiskLevelLegend();
  renderEnterpriseRiskPanel();
  renderElderlyMonitorPanel();
  renderMajorRiskPanel();
  renderRiskList();
  renderRealtimeAlerts();
  renderSelectedAnalysis();
  renderTrend();
  renderRiskTrend();
}

renderAll();
warmVideoCache();

document.querySelectorAll("[data-video-close]").forEach((item) => {
  item.addEventListener("click", closeVideoModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeVideoModal();
});

$("#riskTrendRange").addEventListener("change", (event) => {
  state.riskTrendRange = event.target.value;
  renderRiskTrend();
});

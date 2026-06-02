const state = {
  activeRiskId: dashboardData.risks[0].id,
  activeStation: null,
  activeAlertIndex: 0,
  trendRange: "today",
  majorRiskFilter: false,
};

const $ = (selector) => document.querySelector(selector);

function getLevel(score) {
  if (score >= 75) return { name: "重大", className: "critical" };
  if (score >= 50) return { name: "高", className: "high" };
  if (score >= 30) return { name: "中", className: "medium" };
  return { name: "低", className: "low" };
}

function activeRisk() {
  return dashboardData.risks.find((risk) => risk.id === state.activeRiskId);
}

function activeStation() {
  return dashboardData.stationRiskRatios.find((station) => station.station === state.activeStation);
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

function majorRiskStationsForRisk(riskId) {
  const name = riskTypeName(riskId);
  return dashboardData.stationRiskRatios
    .map((station) => {
      const segment = station.segments.find((item) => item.name === name);
      if (!segment || segment.value < 36) return null;
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

function renderHeroStats() {
  $("#updatedAt").textContent = `更新时间 ${dashboardData.updatedAt}`;
  $("#heroStats").innerHTML = dashboardData.stats
    .map(
      (item) => `
        <article class="stat-card ${item.tone}">
          <span>${item.label}</span>
          <strong>${item.value}<small>${item.unit}</small></strong>
          <em>${item.trend}</em>
        </article>
      `,
    )
    .join("");
}

function renderRiskLevelLegend() {
  const colorNames = {
    低风险: "蓝色",
    中风险: "黄色",
    高风险: "橙色",
    重大风险: "红色",
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

function renderRatioPanels() {
  const legendItems = dashboardData.typeRatios
    .map(
      (item) => `
        <span><i style="background:${item.color}"></i>${item.name}</span>
      `,
    )
    .join("");
  const chartWidth = 720;
  const chartHeight = 250;
  const left = 142;
  const top = 38;
  const cellWidth = 104;
  const cellHeight = 26;
  const gap = 6;
  const riskCounts = dashboardData.stationRiskRatios.flatMap((station) =>
    station.segments.map((segment) => Math.max(0, Math.round((station.total * segment.value) / 100))),
  );
  const maxRiskCount = Math.max(...riskCounts, 1);

  $("#stationRiskChart").innerHTML = `
    <div class="station-risk-legend">${legendItems}</div>
    <svg class="station-risk-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="各风险类型在各站点的风险数量热力图">
      ${dashboardData.typeRatios
        .map((riskType, index) => `
          <text x="${left + index * cellWidth + cellWidth / 2}" y="22" class="station-risk-type-label">${riskType.name}</text>
        `)
        .join("")}
      ${dashboardData.stationRiskRatios
        .map((station, index) => {
          const y = top + index * (cellHeight + gap);
          const shortName = station.station
            .replace("垫江", "")
            .replace("工业园区", "工业园")
            .replace("配气站", "站")
            .replace("澄溪", "");
          return `
            <g>
              <text x="0" y="${y + 18}" class="station-risk-row-name">${shortName}</text>
              ${dashboardData.typeRatios
                .map((riskType, colIndex) => {
                  const segment = station.segments.find((item) => item.name === riskType.name);
                  const count = Math.max(0, Math.round((station.total * (segment?.value || 0)) / 100));
                  const opacity = 0.24 + (count / maxRiskCount) * 0.68;
                  const x = left + colIndex * cellWidth;
                  return `
                    <rect x="${x}" y="${y}" width="${cellWidth - gap}" height="${cellHeight}" rx="7" fill="${riskType.color}" opacity="${opacity}" class="station-risk-cell">
                      <title>${station.station} - ${riskType.name}：${count}件</title>
                    </rect>
                    <text x="${x + (cellWidth - gap) / 2}" y="${y + 18}" class="station-risk-count">${count}</text>
                  `;
                })
                .join("")}
            </g>
          `;
        })
        .join("")}
      <text x="${left}" y="${chartHeight - 8}" class="station-risk-note">横向为风险类型，纵向为站点；数字为告警件数，色块亮度表示数量高低。</text>
    </svg>
  `;

  const majorRisks = dashboardData.typeRatios.map((riskType) => {
    const stations = majorRiskStationsForRisk(riskIdByName(riskType.name));
    return { ...riskType, stations, count: stations.reduce((sum, item) => sum + item.count, 0) };
  });

  $("#typeRatioBars").innerHTML = `
    <div class="major-risk-board">
      ${majorRisks
        .map((item) => {
          const stationText = item.stations.length
            ? item.stations.map((station) => `${station.name}${station.count}件`).join("、")
            : "暂无重大风险站点";
          const isActive = item.count > 0;
          const statusText = isActive ? "需立即关注" : "运行平稳";
          const riskId = riskIdByName(item.name);
          const isSelected = state.majorRiskFilter && state.activeRiskId === riskId;
          return `
            <button class="major-risk-card ${isActive ? "active" : ""} ${isSelected ? "selected" : ""}" type="button" data-risk-id="${riskId}">
              <div class="major-risk-top">
                <span class="danger-mark" style="background:${isActive ? "#f43f5e" : "rgba(148, 163, 184, .28)"}">${isActive ? "!" : "✓"}</span>
                <strong>${item.name}</strong>
              </div>
              <div class="major-risk-number">
                <em>${item.count}</em>
                <span>重大预警</span>
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
      state.activeStation = null;
      state.activeAlertIndex = 0;
      state.majorRiskFilter = true;
      renderAll();
    });
  });
}

function renderRiskList() {
  $("#riskList").innerHTML = dashboardData.risks
    .map((risk) => {
      const level = getLevel(risk.score);
      const displayValue = state.majorRiskFilter && risk.id === state.activeRiskId
        ? currentAlertRows().length
        : risk.score;
      return `
        <button class="risk-card ${risk.id === state.activeRiskId ? "active" : ""}" data-risk-id="${risk.id}">
          <span class="risk-icon">${risk.icon}</span>
          <span class="risk-main">
            <strong>${risk.name}</strong>
            <small>${risk.location}</small>
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
      state.activeStation = null;
      state.activeAlertIndex = 0;
      state.majorRiskFilter = false;
      renderAll();
    });
  });
}

function renderStationControl() {
  $("#clearStation").classList.toggle("active", !state.activeStation);
  $("#stationControlList").innerHTML = dashboardData.stationRiskRatios
    .map((station) => {
      const activeSegment = riskSegmentForStation(station);
      const highCount = activeSegment?.value >= 26 ? Math.max(1, Math.round((station.total * activeSegment.value) / 100)) : 0;
      const riskCount = state.majorRiskFilter
        ? highCount
        : Math.max(1, Math.round((station.total * (activeSegment?.value || 0)) / 100));
      const isActive = station.station === state.activeStation;
      return `
        <button class="station-control-card ${isActive ? "active" : ""}" type="button" data-station="${station.station}">
          <span>
            <strong>${station.station}</strong>
            <small>${state.majorRiskFilter ? "高风险统计" : riskTypeName()} ${activeSegment?.value || 0}%</small>
          </span>
          <em>${riskCount}件</em>
        </button>
      `;
    })
    .join("");

  $("#clearStation").onclick = () => {
    state.activeStation = null;
    state.activeAlertIndex = 0;
    renderAll();
  };

  document.querySelectorAll(".station-control-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeStation = state.activeStation === button.dataset.station ? null : button.dataset.station;
      state.activeAlertIndex = 0;
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
  const station = activeStation();
  if (station) return buildStationRows(station, state.activeRiskId);
  if (state.majorRiskFilter) return buildMajorControlRows(state.activeRiskId);
  let rows;
  if (state.activeRiskId === "construction") rows = dashboardData.constructionVideos;
  else if (state.activeRiskId === "strain") rows = dashboardData.strainRows;
  else if (state.activeRiskId === "cathodic") rows = dashboardData.cathodicRows.map(withCathodicLevel);
  else if (state.activeRiskId === "leak") rows = dashboardData.leakRows;
  else rows = dashboardData.pressureRiskRows;
  return rows;
}

function stationRiskLevel(percent) {
  if (percent >= 36) return "重大风险";
  if (percent >= 26) return "高风险";
  if (percent >= 16) return "中风险";
  return "低风险";
}

function stationFrequency(percent) {
  return {
    low: Math.max(1, Math.round(percent / 12)),
    medium: Math.max(0, Math.round(percent / 18)),
    high: Math.max(0, Math.round(percent / 28)),
    critical: percent >= 36 ? 1 : 0,
  };
}

function cathodicLevelByOffPotential(value, sustainedHours = 2) {
  const potential = Number(value);
  if (Number.isNaN(potential)) return "正常";
  if (sustainedHours < 2 && potential > -0.85) return "低风险";
  if (potential > -0.68) return "重大风险";
  if (potential > -0.77) return "高风险";
  if (potential > -0.81) return "中风险";
  if (potential > -0.85) return "低风险";
  if (potential >= -1.2) return "正常";
  return "高风险";
}

function withCathodicLevel(row) {
  return {
    ...row,
    level: cathodicLevelByOffPotential(row.offPotential, row.sustainedHours),
  };
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
        level: "重大风险",
        frequency: { low: 0, medium: 0, high: 0, critical: total },
        cause: `${stationInfo.name}${risk.name}重大风险累计${stationInfo.count}件，当前纳入重大风险管控筛选，需按站点和风险类型集中核查。`,
        impact: `该风险类型共触发${total}条重大告警，若未及时处置，可能影响站点安全裕度、管段运行稳定和应急资源调度。`,
        advice: `优先处理${stationInfo.name}相关告警，核查实时监测值、现场设备状态和历史处置记录，并将${total}条重大风险纳入闭环工单。`,
      };

      if (riskId === "construction") {
        return {
          ...common,
          title: `${stationInfo.name} 周边施工重大预警 ${sequence}`,
          camera: `${stationInfo.name} ${String(sequence).padStart(2, "0")}#球机`,
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
        return {
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
      }

      if (riskId === "leak") {
        return {
          ...common,
          code: `DF-GAS-M${String(sequence).padStart(3, "0")}`,
          type: "物联网阀门井气体报警器",
          pressure: `${(0.42 + (sequence % 3) * 0.01).toFixed(2)}MPa`,
          gas: `${18 + (sequence % 4)}%LEL`,
        };
      }

      return {
        ...common,
        code: `DF-PT-M${String(sequence).padStart(3, "0")}`,
        type: "智能远程压力监测终端",
        pressure: (1.56 + (sequence % 4) * 0.01).toFixed(2),
      };
    }),
  );
}

function buildStationRows(station, riskId) {
  const risk = dashboardData.risks.find((item) => item.id === riskId);
  const segment = riskSegmentForStation(station, riskId) || { value: 18 };
  const level = stationRiskLevel(segment.value);
  const frequency = stationFrequency(segment.value);
  const baseCode = station.station.replace(/[（）()]/g, "").slice(0, 2).toUpperCase();
  const common = {
    region: "重庆/垫江/鼎发燃气",
    level,
    frequency,
    cause: `${station.station}在${risk.name}维度占比为${segment.value}%，当前风险贡献高于站点日常均值，需结合实时监测数据复核。`,
    impact: `若该站点${risk.name}持续升高，可能影响站内设备运行、周边管段安全裕度和后续处置资源调度。`,
    advice: `建议调度中心优先核查${station.station}的${risk.name}监测记录，联动属地巡检并对连续异常点位生成处置工单。`,
  };

  if (riskId === "construction") {
    return [0, 1, 2, 3, 4, 5].map((item) => ({
      ...common,
      title: `${station.station} 周边施工视频预警 ${item + 1}`,
      time: `2026-05-30 17:${String(42 - item * 3).padStart(2, "0")}:1${item}`,
      camera: `${station.station} ${String(item + 1).padStart(2, "0")}#枪机`,
      distance: item === 0 ? "10m红区" : item <= 2 ? "26m管控区" : "45m关注区",
      beforeAfter: "前后30s视频",
      thumbnail: dashboardData.constructionVideos[item]?.thumbnail || dashboardData.constructionVideos[0].thumbnail,
    }));
  }

  if (riskId === "cathodic") {
    const offPotentials = [-0.66, -0.73, -0.79, -0.83];
    return [0, 1, 2, 3].map((item) => ({
      ...common,
      time: `2026-05-30 17:${42 - item}:16`,
      station: `${station.station} CP-${String(17 + item).padStart(3, "0")}`,
      offPotential: offPotentials[item].toFixed(2),
      sustainedHours: 2,
      level: cathodicLevelByOffPotential(offPotentials[item], 2),
      dcDensity: (10 + segment.value / 2 - item * 0.9).toFixed(1),
      acDensity: (2.1 + segment.value / 20 - item * 0.2).toFixed(1),
      acVoltage: (4.6 + segment.value / 10 - item * 0.3).toFixed(1),
      naturalPotential: (-0.76 - item * 0.03).toFixed(2),
      anodeOpenPotential: (1.12 + item * 0.02).toFixed(2),
      anodeCurrent: String(34 + item * 3),
      signal: `${92 - item * 3}%`,
      battery: (3.62 - item * 0.03).toFixed(2),
    }));
  }

  const fieldByRisk = {
    strain: { code: "SS", type: "管道应力应变监测终端", key: "strain", values: ["418", "392", "356", "311"] },
    leak: { code: "GAS", type: "物联网阀门井气体报警器", key: "gas", values: ["16%LEL", "11%LEL", "7%LEL", "4%LEL"], pressureValues: ["0.42MPa", "0.39MPa", "0.36MPa", "0.34MPa"] },
    pressure: { code: "PT", type: "智能远程压力监测终端", key: "pressure", values: ["1.56", "1.51", "1.47", "1.42"] },
  }[riskId] || { code: "PT", type: "智能远程压力监测终端", key: "pressure", values: ["1.50", "1.46", "1.43", "1.39"] };

  return [0, 1, 2, 3].map((item) => ({
    ...common,
    time: `2026-05-30 17:${42 - item}:1${6 - item}`,
    station: station.station,
    code: `DF-${fieldByRisk.code}-${baseCode}${String(item + 1).padStart(3, "0")}`,
    type: fieldByRisk.type,
    pressure: riskId === "leak" ? fieldByRisk.pressureValues[item] : undefined,
    [fieldByRisk.key]: fieldByRisk.values[item],
  }));
}

function pressureClass(level) {
  return {
    正常: "pressure-normal",
    低风险: "pressure-low",
    中风险: "pressure-medium",
    高风险: "pressure-high",
    重大风险: "pressure-critical",
  }[level] || "pressure-normal";
}

function renderEmptyRealtime(message = "暂无重大风险数据") {
  $("#realtimeContent").innerHTML = `
    <div class="empty-state">
      <span>!</span>
      <strong>${message}</strong>
      <p>当前筛选条件下未发现需要处置的重大风险告警。</p>
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
    leak: "LEL",
    pressure: "压力 MPa",
  };
  panelLabel.textContent = valueLabels[state.activeRiskId] || "压力 MPa";
  const rows = currentAlertRows();
  if (!rows.length) {
    renderEmptyRealtime();
    return;
  }
  const valueColumn = {
    strain: "应变με",
    leak: "气体浓度",
    pressure: "压力MPa",
  }[state.activeRiskId] || "监测值";
  const leakExtraHeader = state.activeRiskId === "leak" ? "<th>压力</th>" : "";
  $("#realtimeContent").innerHTML = `
    <div class="risk-table-wrap">
      <table class="risk-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>站点名称</th>
            <th>区域</th>
            <th>通讯编号</th>
            <th>设备类型</th>
            ${leakExtraHeader}
            <th>${valueColumn}</th>
          </tr>
        </thead>
        <tbody id="alertTableBody"></tbody>
      </table>
    </div>
  `;

  $("#alertTableBody").innerHTML = rows
    .map(
      (row, index) => `
        <tr class="${index === state.activeAlertIndex ? "active" : ""}" data-alert-index="${index}">
          <td>${row.time}</td>
          <td>${row.station}</td>
          <td>${row.region}</td>
          <td>${row.code}</td>
          <td>${row.type}</td>
          ${state.activeRiskId === "leak" ? `<td>${row.pressure || "-"}</td>` : ""}
          <td><strong class="${pressureClass(row.level)}">${row.gas || row.pressure || row.strain}</strong></td>
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
}

function renderStrainTable() {
  const rows = currentAlertRows();
  if (!rows.length) {
    renderEmptyRealtime();
    return;
  }
  $("#realtimeContent").innerHTML = `
    <div class="risk-table-wrap">
      <table class="risk-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>站点名称</th>
            <th>区域</th>
            <th>通讯编号</th>
            <th>应变值</th>
          </tr>
        </thead>
        <tbody id="alertTableBody">
          ${rows
            .map(
              (row, index) => `
                <tr class="${index === state.activeAlertIndex ? "active" : ""}" data-alert-index="${index}">
                  <td>${row.time}</td>
                  <td>${row.station}</td>
                  <td>${row.region}</td>
                  <td>${row.code}</td>
                  <td><strong class="${pressureClass(row.level)}">${row.strain}</strong></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll("#alertTableBody tr").forEach((row) => {
    row.addEventListener("click", () => {
      state.activeAlertIndex = Number(row.dataset.alertIndex);
      renderStrainTable();
      renderSelectedAnalysis();
    });
  });
}

function renderCathodicTable() {
  const rows = currentAlertRows();
  if (!rows.length) {
    renderEmptyRealtime();
    return;
  }
  $("#realtimeContent").innerHTML = `
    <div class="risk-table-wrap">
      <table class="risk-table cathodic-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>站点名称</th>
            <th>断电电位(V)</th>
            <th>直流电流密度</th>
            <th>交流电流密度</th>
            <th>交流电压</th>
            <th>自然电位(V)</th>
            <th>阳极开路电位(V)</th>
            <th>阳极输出电流(mA)</th>
            <th>信号强度</th>
            <th>电池电压(V)</th>
          </tr>
        </thead>
        <tbody id="alertTableBody">
          ${rows
            .map(
              (row, index) => `
                <tr class="${index === state.activeAlertIndex ? "active" : ""}" data-alert-index="${index}">
                  <td>${row.time}</td>
                  <td>${row.station}</td>
                  <td><strong class="${pressureClass(row.level)}">${row.offPotential}</strong></td>
                  <td>${row.dcDensity}</td>
                  <td>${row.acDensity}</td>
                  <td>${row.acVoltage}</td>
                  <td>${row.naturalPotential}</td>
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
  `;

  document.querySelectorAll("#alertTableBody tr").forEach((row) => {
    row.addEventListener("click", () => {
      state.activeAlertIndex = Number(row.dataset.alertIndex);
      renderCathodicTable();
      renderSelectedAnalysis();
    });
  });
}

function renderConstructionVideos() {
  const rows = currentAlertRows();
  if (!rows.length) {
    renderEmptyRealtime();
    return;
  }
  $("#realtimeContent").innerHTML = `
    <div class="video-grid">
      ${rows
        .map(
          (item, index) => `
            <button class="video-card ${index === state.activeAlertIndex ? "active" : ""}" type="button" data-alert-index="${index}" title="点击查看该风险前后总共30s的视频">
              <span class="video-thumb" style="background:${item.thumbnail}">
                <i></i>
              </span>
              <strong>${item.title}</strong>
              <small>${item.time} · ${item.camera}</small>
              <em>${item.distance} · ${item.level} · ${item.beforeAfter}</em>
            </button>
          `,
        )
        .join("")}
    </div>
  `;

  document.querySelectorAll(".video-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.activeAlertIndex = Number(card.dataset.alertIndex);
      renderConstructionVideos();
      renderSelectedAnalysis();
    });
  });
}

function renderSelectedAnalysis() {
  const alert = activeAlert();
  const risk = activeRisk();
  if (!alert) {
    $("#selectedAlertLabel").textContent = "暂无数据";
    $("#selectedAnalysis").innerHTML = `
      <article class="model-analysis empty-analysis">
        <div class="analysis-summary">
          <strong>${risk.name}暂无重大风险告警</strong>
          <span>重大风险筛选</span>
        </div>
        <section>
          <h3>研判结果</h3>
          <p>当前风险类型下未发现重大风险实时告警，建议保持常规监测，并持续关注站点风险管控与趋势变化。</p>
        </section>
      </article>
    `;
    return;
  }
  const frequencyText = `低风险 ${alert.frequency.low} 次，中风险 ${alert.frequency.medium} 次，高风险 ${alert.frequency.high} 次，重大风险 ${alert.frequency.critical} 次。`;
  const metricText = risk.metrics
    .map((metric) => `${metric.label}：${metric.value}（${metric.state}）`)
    .join("；");

  $("#selectedAlertLabel").textContent = alert.station || alert.title;
  $("#selectedAnalysis").innerHTML = `
    <article class="model-analysis">
      <div class="analysis-summary">
        <strong>${alert.station || alert.title}</strong>
        <span>${risk.name} · ${alert.level || getLevel(risk.score).name + "风险"}</span>
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
  const canvas = $("#trendCanvas");
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const stations = dashboardData.stationRiskRatios;
  const riskTypes = dashboardData.typeRatios;
  const rangeNames = { today: "今日", week: "近7天", month: "近30天" };
  const rangeFactor = { today: 1, week: 4.8, month: 15.6 }[state.trendRange] || 1;
  const left = 80;
  const right = 38;
  const top = 58;
  const bottom = 72;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const series = riskTypes.map((riskType) => ({
    ...riskType,
    values: stations.map((station) => {
      const segment = station.segments.find((item) => item.name === riskType.name);
      return Math.max(1, Math.round(((segment?.value || 0) / 100) * station.total * rangeFactor));
    }),
  }));
  const maxValue = Math.max(...series.flatMap((item) => item.values), 5);
  const yMax = Math.ceil(maxValue / 5) * 5;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#07111f";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(148, 163, 184, .18)";
  context.lineWidth = 1;
  context.font = "12px Arial";
  context.textAlign = "right";
  context.fillStyle = "#94a3b8";
  for (let i = 0; i <= 5; i += 1) {
    const value = (yMax / 5) * i;
    const y = top + chartHeight - (value / yMax) * chartHeight;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(width - right, y);
    context.stroke();
    context.fillText(String(Math.round(value)), left - 12, y + 4);
  }

  context.strokeStyle = "rgba(125, 211, 252, .32)";
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left, top + chartHeight);
  context.lineTo(width - right, top + chartHeight);
  context.stroke();

  context.fillStyle = "#94a3b8";
  context.font = "16px Arial";
  context.textAlign = "left";
  context.fillText(`${rangeNames[state.trendRange]}各站点风险次数趋势`, left, 26);

  stations.forEach((station, colIndex) => {
    const x = left + (chartWidth / (stations.length - 1)) * colIndex;
    const shortName = station.station
      .replace("垫江", "")
      .replace("工业园区", "工业园")
      .replace("配气站", "站")
      .replace("澄溪", "");
    context.fillStyle = "#cbd5e1";
    context.font = "12px Arial";
    context.textAlign = "center";
    context.fillText(shortName, x, height - 32);
  });

  series.forEach((riskType) => {
    const points = riskType.values.map((value, index) => ({
      value,
      x: left + (chartWidth / (stations.length - 1)) * index,
      y: top + chartHeight - (value / yMax) * chartHeight,
    }));

    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.strokeStyle = riskType.color;
    context.lineWidth = 3;
    context.shadowColor = riskType.color;
    context.shadowBlur = 10;
    context.stroke();
    context.shadowBlur = 0;

    points.forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, 4, 0, Math.PI * 2);
      context.fillStyle = "#07111f";
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = riskType.color;
      context.stroke();
    });
  });

  let legendX = left + 260;
  riskTypes.forEach((riskType) => {
    context.fillStyle = riskType.color;
    context.fillRect(legendX, 16, 18, 4);
    context.fillStyle = "#cbd5e1";
    context.font = "12px Arial";
    context.textAlign = "left";
    context.fillText(riskType.name, legendX + 24, 20);
    legendX += 116;
  });

  context.textAlign = "left";
  context.fillStyle = "#93a4b8";
  context.font = "13px Arial";
  context.fillText("横坐标：站点  /  纵坐标：告警次数  /  折线：五类风险走势", left, height - 8);
  $("#trendLabel").textContent = rangeNames[state.trendRange];
}

function renderAll() {
  renderHeroStats();
  renderRiskLevelLegend();
  renderRatioPanels();
  renderRiskList();
  renderStationControl();
  renderRealtimeAlerts();
  renderSelectedAnalysis();
  renderTrend();
}

renderAll();

$("#trendRange").addEventListener("change", (event) => {
  state.trendRange = event.target.value;
  renderTrend();
});

const PDFDocument = require("pdfkit");

const PAGE = Object.freeze({
  margin: 46,
  top: 52,
  bottom: 54,
  width: 503,
});

const COLORS = Object.freeze({
  ink: "#0f172a",
  heading: "#1e293b",
  muted: "#64748b",
  border: "#dbe4ee",
  panel: "#f8fafc",
  white: "#ffffff",
  brand: "#0f4c81",
  brandSoft: "#e0f2fe",
  accent: "#0ea5e9",
  success: "#15803d",
  successSoft: "#ecfdf5",
  warning: "#b45309",
  warningSoft: "#fff7ed",
  danger: "#b91c1c",
  dangerSoft: "#fef2f2",
  rowAlt: "#f8fafc",
});

const DEFAULT_THRESHOLDS = Object.freeze({
  lowSpo2: 90,
  lowBpm: 50,
  highBpm: 120,
});

const RANGE_LABELS = Object.freeze({
  day: "Last 24 Hours",
  week: "Last 7 Days",
  month: "Last 30 Days",
});

const buildCsvReport = ({ patient, readings }) => {
  const header = "Timestamp,SpO2,BPM\n";
  const rows = readings
    .map(
      (reading) =>
        `${new Date(reading.timestamp).toISOString()},${reading.spo2},${reading.bpm}`
    )
    .join("\n");

  return Buffer.from(
    `${header}${rows}\n\nGenerated For,${patient.name}\nEmail,${patient.email}\n`,
    "utf8"
  );
};

const formatDateTime = (value) => {
  if (!value) {
    return "N/A";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatMetricValue = (value, suffix = "") =>
  value === null || value === undefined ? "N/A" : `${value}${suffix}`;

const getRangeLabel = (range) => RANGE_LABELS[range] || String(range || "Custom");

const formatPeriod = (period, readings) => {
  if (period?.start && period?.end) {
    return `${formatDateTime(period.start)} - ${formatDateTime(period.end)}`;
  }

  if (!readings.length) {
    return "No readings recorded";
  }

  return `${formatDateTime(readings[0].timestamp)} - ${formatDateTime(
    readings[readings.length - 1].timestamp
  )}`;
};

const getReadingStatus = (reading) => {
  const hasLowSpo2 = Number(reading?.spo2) < DEFAULT_THRESHOLDS.lowSpo2;
  const hasLowBpm = Number(reading?.bpm) < DEFAULT_THRESHOLDS.lowBpm;
  const hasHighBpm = Number(reading?.bpm) > DEFAULT_THRESHOLDS.highBpm;
  const flagCount = [hasLowSpo2, hasLowBpm, hasHighBpm].filter(Boolean).length;

  if (flagCount > 1) {
    return {
      label: "Multiple flags",
      color: COLORS.danger,
      background: COLORS.dangerSoft,
    };
  }

  if (hasLowSpo2) {
    return {
      label: "Low SpO2",
      color: COLORS.danger,
      background: COLORS.dangerSoft,
    };
  }

  if (hasLowBpm) {
    return {
      label: "Low BPM",
      color: COLORS.warning,
      background: COLORS.warningSoft,
    };
  }

  if (hasHighBpm) {
    return {
      label: "High BPM",
      color: COLORS.warning,
      background: COLORS.warningSoft,
    };
  }

  return {
    label: "Stable",
    color: COLORS.success,
    background: COLORS.successSoft,
  };
};

const countFlaggedReadings = (readings) =>
  readings.filter(
    (reading) =>
      Number(reading.spo2) < DEFAULT_THRESHOLDS.lowSpo2 ||
      Number(reading.bpm) < DEFAULT_THRESHOLDS.lowBpm ||
      Number(reading.bpm) > DEFAULT_THRESHOLDS.highBpm
  ).length;

const buildHighlights = ({ summary, readings, period }) => {
  if (!readings.length) {
    return [
      `No readings were recorded during the ${getRangeLabel(period?.range).toLowerCase()} report window.`,
      "The export still includes patient and report metadata for documentation purposes.",
      "Capture new measurements, then regenerate the report to populate the vital summary and log.",
    ];
  }

  const earliestReading = readings[0];
  const latestReading = readings[readings.length - 1];
  const flaggedReadings = countFlaggedReadings(readings);
  const spo2Range =
    summary.minimumSpo2 === null || summary.maximumSpo2 === null
      ? "N/A"
      : `${summary.minimumSpo2}% - ${summary.maximumSpo2}%`;
  const bpmRange =
    summary.minimumBpm === null || summary.maximumBpm === null
      ? "N/A"
      : `${summary.minimumBpm} - ${summary.maximumBpm} BPM`;

  return [
    `Captured ${summary.totalReadings} readings from ${formatDateTime(
      earliestReading.timestamp
    )} to ${formatDateTime(latestReading.timestamp)}.`,
    flaggedReadings > 0
      ? `${flaggedReadings} readings were outside the default thresholds of ${DEFAULT_THRESHOLDS.lowSpo2}% SpO2 and ${DEFAULT_THRESHOLDS.lowBpm}-${DEFAULT_THRESHOLDS.highBpm} BPM.`
      : `All recorded readings stayed within the default thresholds of ${DEFAULT_THRESHOLDS.lowSpo2}% SpO2 and ${DEFAULT_THRESHOLDS.lowBpm}-${DEFAULT_THRESHOLDS.highBpm} BPM.`,
    `Observed ranges: SpO2 ${spo2Range}; BPM ${bpmRange}. Latest reading was ${latestReading.spo2}% SpO2 and ${latestReading.bpm} BPM.`,
  ];
};

const drawPanel = (document, x, y, width, height, fill, stroke, radius = 14) => {
  document.roundedRect(x, y, width, height, radius).fillAndStroke(fill, stroke);
};

const drawLabelValuePair = (document, x, y, label, value, width) => {
  document
    .fillColor(COLORS.muted)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(label, x, y, { width });
  document
    .fillColor(COLORS.ink)
    .font("Helvetica")
    .fontSize(11)
    .text(value, x, y + 14, { width });
};

const drawMetricCard = (document, x, y, width, metric) => {
  drawPanel(document, x, y, width, 84, COLORS.white, COLORS.border, 12);
  document.roundedRect(x + 14, y + 14, 34, 6, 3).fill(metric.accent);
  document
    .fillColor(COLORS.muted)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(metric.label, x + 14, y + 28, { width: width - 28 });
  document
    .fillColor(COLORS.heading)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(metric.value, x + 14, y + 44, { width: width - 28 });
  if (metric.note) {
    document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8.5)
      .text(metric.note, x + 14, y + 68, { width: width - 28 });
  }
};

const drawOverviewPage = (document, { patient, period, summary, readings, generatedAt }) => {
  const left = document.page.margins.left;
  const cardGap = 12;
  const halfWidth = (PAGE.width - cardGap) / 2;
  const thirdWidth = (PAGE.width - cardGap * 2) / 3;
  const rangeLabel = getRangeLabel(period?.range);
  const periodLabel = formatPeriod(period, readings);
  const highlights = buildHighlights({ summary, readings, period });
  const flaggedReadings = countFlaggedReadings(readings);

  let currentY = document.page.margins.top;

  drawPanel(document, left, currentY, PAGE.width, 102, COLORS.brand, COLORS.brand, 18);
  document
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(26)
    .text("Pulse Oximeter Report", left + 24, currentY + 20, {
      width: 320,
    });
  document
    .fillColor("#dbeafe")
    .font("Helvetica")
    .fontSize(11)
    .text("Patient monitoring summary with vitals, thresholds, and measurement log.", left + 24, currentY + 54, {
      width: 320,
    });
  document.roundedRect(left + 382, currentY + 22, 97, 28, 14).fill(COLORS.accent);
  document
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(rangeLabel, left + 390, currentY + 31, {
      width: 81,
      align: "center",
    });
  document
    .fillColor("#dbeafe")
    .font("Helvetica")
    .fontSize(9)
    .text(`Generated ${formatDateTime(generatedAt)}`, left + 320, currentY + 66, {
      width: 159,
      align: "right",
    });

  currentY += 122;

  drawPanel(document, left, currentY, halfWidth, 98, COLORS.panel, COLORS.border, 14);
  document
    .fillColor(COLORS.heading)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("Patient Details", left + 16, currentY + 16);
  drawLabelValuePair(
    document,
    left + 16,
    currentY + 38,
    "Name",
    patient.name || "N/A",
    halfWidth - 32
  );
  drawLabelValuePair(
    document,
    left + 16,
    currentY + 62,
    "Email",
    patient.email || "N/A",
    halfWidth - 32
  );

  drawPanel(
    document,
    left + halfWidth + cardGap,
    currentY,
    halfWidth,
    98,
    COLORS.panel,
    COLORS.border,
    14
  );
  document
    .fillColor(COLORS.heading)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("Report Window", left + halfWidth + cardGap + 16, currentY + 16);
  drawLabelValuePair(
    document,
    left + halfWidth + cardGap + 16,
    currentY + 38,
    "Period",
    periodLabel,
    halfWidth - 32
  );
  drawLabelValuePair(
    document,
    left + halfWidth + cardGap + 16,
    currentY + 62,
    "Thresholds",
    `${DEFAULT_THRESHOLDS.lowSpo2}% SpO2, ${DEFAULT_THRESHOLDS.lowBpm}-${DEFAULT_THRESHOLDS.highBpm} BPM`,
    halfWidth - 32
  );

  currentY += 118;

  document
    .fillColor(COLORS.heading)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("Vital Summary", left, currentY);
  currentY += 24;

  const metrics = [
    {
      label: "Average SpO2",
      value: formatMetricValue(summary.averageSpo2, "%"),
      note: "Average oxygen saturation",
      accent: COLORS.accent,
    },
    {
      label: "Lowest SpO2",
      value: formatMetricValue(summary.minimumSpo2, "%"),
      note: "Minimum recorded value",
      accent: "#0284c7",
    },
    {
      label: "Average BPM",
      value: formatMetricValue(summary.averageBpm),
      note: "Average heart rate",
      accent: "#f97316",
    },
    {
      label: "Highest BPM",
      value: formatMetricValue(summary.maximumBpm),
      note: "Peak heart rate in range",
      accent: "#dc2626",
    },
    {
      label: "Total Readings",
      value: formatMetricValue(summary.totalReadings),
      note: "Samples in selected window",
      accent: "#6366f1",
    },
    {
      label: "Flagged Readings",
      value: formatMetricValue(flaggedReadings),
      note: "Outside default thresholds",
      accent: flaggedReadings > 0 ? COLORS.warning : COLORS.success,
    },
  ];

  metrics.forEach((metric, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = left + column * (thirdWidth + cardGap);
    const y = currentY + row * 96;
    drawMetricCard(document, x, y, thirdWidth, metric);
  });

  currentY += 204;

  document
    .fillColor(COLORS.heading)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("Clinical Snapshot", left, currentY);
  currentY += 24;

  document.font("Helvetica").fontSize(10.5);
  const insightTextWidth = PAGE.width - 54;
  const insightPanelHeight =
    highlights.reduce(
      (totalHeight, highlight) =>
        totalHeight + document.heightOfString(highlight, { width: insightTextWidth }) + 10,
      0
    ) + 26;

  drawPanel(
    document,
    left,
    currentY,
    PAGE.width,
    insightPanelHeight,
    COLORS.panel,
    COLORS.border,
    14
  );
  let insightY = currentY + 18;
  highlights.forEach((highlight) => {
    document
      .fillColor(COLORS.heading)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("-", left + 18, insightY);
    document
      .fillColor(COLORS.heading)
      .font("Helvetica")
      .fontSize(10.5)
      .text(highlight, left + 32, insightY, {
        width: insightTextWidth,
      });
    insightY += document.heightOfString(highlight, {
      width: insightTextWidth,
    }) + 10;
  });
};

const drawMeasurementsPageHeader = (document, patient, period) => {
  const left = document.page.margins.left;
  const tableTop = document.page.margins.top;

  document
    .fillColor(COLORS.heading)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("Measurement Log", left, tableTop);
  document
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(10)
    .text(
      `${patient.name || "Patient"} | ${getRangeLabel(period?.range)} | ${formatPeriod(
        period,
        []
      )}`,
      left,
      tableTop + 22,
      { width: PAGE.width }
    );

  const headerY = tableTop + 48;
  document.roundedRect(left, headerY, PAGE.width, 26, 10).fill(COLORS.brandSoft);
  document
    .fillColor(COLORS.heading)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("Timestamp", left + 14, headerY + 8, { width: 228 })
    .text("SpO2", left + 244, headerY + 8, { width: 58, align: "center" })
    .text("BPM", left + 304, headerY + 8, { width: 58, align: "center" })
    .text("Status", left + 378, headerY + 8, { width: 111, align: "center" });

  document.y = headerY + 34;
};

const drawStatusPill = (document, x, y, width, status) => {
  document.roundedRect(x, y, width, 16, 8).fill(status.color);
  document
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(status.label, x, y + 4, {
      width,
      align: "center",
    });
};

const drawMeasurementsTable = (document, { patient, period, readings }) => {
  if (!readings.length) {
    return;
  }

  const left = document.page.margins.left;
  const rowHeight = 24;
  const footerReserve = 24;

  document.addPage();
  drawMeasurementsPageHeader(document, patient, period);

  readings.forEach((reading, index) => {
    if (
      document.y + rowHeight >
      document.page.height - document.page.margins.bottom - footerReserve
    ) {
      document.addPage();
      drawMeasurementsPageHeader(document, patient, period);
    }

    const rowY = document.y;
    const status = getReadingStatus(reading);

    if (index % 2 === 0) {
      document.rect(left, rowY - 2, PAGE.width, rowHeight).fill(COLORS.rowAlt);
    }

    document
      .fillColor(COLORS.heading)
      .font("Helvetica")
      .fontSize(9.5)
      .text(formatDateTime(reading.timestamp), left + 14, rowY + 5, {
        width: 220,
      })
      .text(String(reading.spo2), left + 244, rowY + 5, {
        width: 58,
        align: "center",
      })
      .text(String(reading.bpm), left + 304, rowY + 5, {
        width: 58,
        align: "center",
      });

    drawStatusPill(document, left + 388, rowY + 4, 90, status);

    document
      .strokeColor(COLORS.border)
      .moveTo(left, rowY + rowHeight)
      .lineTo(left + PAGE.width, rowY + rowHeight)
      .stroke();

    document.y = rowY + rowHeight;
  });
};

const drawPageFooters = (document, patient) => {
  const range = document.bufferedPageRange();

  for (let index = 0; index < range.count; index += 1) {
    document.switchToPage(range.start + index);

    const left = document.page.margins.left;
    const footerY = document.page.height - document.page.margins.bottom + 4;

    document
      .strokeColor(COLORS.border)
      .moveTo(left, footerY - 8)
      .lineTo(left + PAGE.width, footerY - 8)
      .stroke();
    document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(8.5)
      .text(`Pulse Oximeter Report | ${patient.name || "Patient"}`, left, footerY, {
        width: 280,
      })
      .text(`Page ${index + 1} of ${range.count}`, left + 360, footerY, {
        width: 143,
        align: "right",
      });
  }
}

const buildPdfReport = ({ patient, period, summary, readings }) =>
  new Promise((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      bufferPages: true,
      margins: {
        top: PAGE.top,
        bottom: PAGE.bottom,
        left: PAGE.margin,
        right: PAGE.margin,
      },
    });
    const chunks = [];
    const generatedAt = new Date();

    document.info.Title = `Pulse Oximeter Report - ${patient.name || "Patient"}`;
    document.info.Author = "Pulse Oximeter Platform";
    document.info.Subject = "Patient vital signs report";
    document.info.Keywords = "pulse oximeter, spo2, bpm, patient report";
    document.info.CreationDate = generatedAt;

    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    drawOverviewPage(document, {
      patient,
      period,
      summary,
      readings,
      generatedAt,
    });
    drawMeasurementsTable(document, {
      patient,
      period,
      readings,
    });
    drawPageFooters(document, patient);

    document.end();
  });

module.exports = {
  buildCsvReport,
  buildPdfReport,
};
